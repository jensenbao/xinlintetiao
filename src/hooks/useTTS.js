import { useEffect, useState, useCallback, useRef } from 'react';
import { API_CONFIG } from '../config/api.js';

/**
 * TTS strategy:
 * Use remote TTS only. If the returned transcript does not match the on-screen text,
 * drop the audio instead of falling back to browser SpeechSynthesis.
 */
export const useTTS = () => {
  const [voices, setVoices] = useState([]);
  const currentAudioRef = useRef(null);
  const activeFetchRef = useRef(null);
  const audioContextRef = useRef(null);
  const currentSourceRef = useRef(null);
  const requestSeqRef = useRef(0);
  const OPENAI_TTS_VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer', 'verse'];
  const strictTextSync = API_CONFIG.remoteTts?.strictTextSync ?? true;
  const remoteTtsEnabled = API_CONFIG.remoteTts?.enabled ?? false;
  const ttsDebug = API_CONFIG.remoteTts?.debug ?? true;
  const remoteTtsEndpoint = String(API_CONFIG.remoteTts?.endpoint || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
  const isOpenRouterEndpoint = /openrouter\.ai$/i.test(
    (() => {
      try {
        return new URL(remoteTtsEndpoint).hostname;
      } catch {
        return '';
      }
    })()
  );
  const remoteTtsApiKey = String(API_CONFIG.remoteTts?.apiKey || '').trim();
  const remoteTtsVoice = String(API_CONFIG.remoteTts?.voice || 'alloy').trim();
  const remoteTtsFormat = String(API_CONFIG.remoteTts?.format || 'pcm16').trim().toLowerCase();
  const remoteTtsModelRaw = String(API_CONFIG.remoteTts?.model || 'openai/gpt-audio-mini').trim();

  const remoteTtsModels = Array.from(
    new Set(
      [
        remoteTtsModelRaw,
        /^(google|openai)\//.test(remoteTtsModelRaw)
          ? remoteTtsModelRaw
          : `google/${remoteTtsModelRaw}`,
      ].filter(Boolean)
    )
  );

  const isOpenAiTtsModel = remoteTtsModels.some((model) => /^openai\//.test(model));

  useEffect(() => {
    const synth = window.speechSynthesis;
    if (!synth) return;

    const updateVoices = () => {
      setVoices(synth.getVoices());
    };

    updateVoices();
    if (synth.onvoiceschanged !== undefined) {
      synth.onvoiceschanged = updateVoices;
    }
  }, []);

  const normalizeSpokenText = useCallback((text) => {
    return String(text || '')
      .replace(/\*+([^*]+)\*+/g, '$1')
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, '\'')
      .replace(/\s+/g, ' ')
      .trim();
  }, []);

  const normalizeTtsComparisonText = useCallback((text) => {
    return normalizeSpokenText(text)
      .replace(/[.,!?;:]/g, '')
      .replace(/…/g, '')
      .replace(/["']/g, '')
      .toLowerCase();
  }, [normalizeSpokenText]);

  const isTranscriptCloseEnough = useCallback((expectedText, actualText) => {
    const expected = normalizeTtsComparisonText(expectedText);
    const actual = normalizeTtsComparisonText(actualText);
    if (!expected || !actual) return false;
    if (expected === actual) return true;
    if (expected.includes(actual) || actual.includes(expected)) return true;

    const expectedTokens = expected.split(/\s+/).filter(Boolean);
    const actualTokens = actual.split(/\s+/).filter(Boolean);
    if (expectedTokens.length === 0 || actualTokens.length === 0) return false;

    let matches = 0;
    const actualBag = new Map();
    for (const token of actualTokens) {
      actualBag.set(token, (actualBag.get(token) || 0) + 1);
    }

    for (const token of expectedTokens) {
      const count = actualBag.get(token) || 0;
      if (count > 0) {
        matches += 1;
        actualBag.set(token, count - 1);
      }
    }

    const overlap = matches / Math.max(expectedTokens.length, actualTokens.length);
    return overlap >= 0.85;
  }, [normalizeTtsComparisonText]);

  const createTtsScript = useCallback((text) => {
    return normalizeSpokenText(text)
      .replace(/\s*\.\.\.\s*/g, ', ')
      .replace(/\s*…\s*/g, ', ')
      .replace(/\s*--\s*/g, ', ')
      .replace(/\s*-\s*/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }, [normalizeSpokenText]);

  const looksLikeInstructionReply = useCallback((text) => {
    const normalized = normalizeSpokenText(text).toLowerCase();
    if (!normalized) return false;

    return [
      /i will read/,
      /i[' ]?ll read/,
      /i will say/,
      /i[' ]?ll say/,
      /you gave me/,
      /the text you gave me/,
      /provided text/,
      /verbatim/,
      /read the provided text/,
      /明白/,
      /我会读/,
      /你给我的内容/,
      /逐字/,
      /照着读/,
    ].some((pattern) => pattern.test(normalized));
  }, [normalizeSpokenText]);

  const logTtsDebug = useCallback((label, payload = {}) => {
    if (!ttsDebug) return;
    console.log(`[TTS] ${label}`, payload);
  }, [ttsDebug]);

  const hashStr = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i += 1) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
  };

  const pickVoiceFromPool = useCallback((seed, pool) => {
    const options = Array.isArray(pool) && pool.length > 0 ? pool : OPENAI_TTS_VOICES;
    const index = hashStr(String(seed || 'default')) % options.length;
    return options[index];
  }, []);

  const resolveCharacterTtsVoice = useCallback((aiConfig) => {
    const explicitVoice = String(
      aiConfig?.ttsVoice ||
      aiConfig?.voiceProfile?.ttsVoice ||
      aiConfig?.dialogueStyle?.ttsVoice ||
      ''
    ).trim().toLowerCase();

    if (explicitVoice) {
      return explicitVoice;
    }

    if (!isOpenAiTtsModel) {
      return remoteTtsVoice;
    }

    const descriptorText = [
      ...(Array.isArray(aiConfig?.personality) ? aiConfig.personality : []),
      ...(Array.isArray(aiConfig?.dialogueStyle?.features) ? aiConfig.dialogueStyle.features : []),
      ...(Array.isArray(aiConfig?.voiceProfile?.anchors) ? aiConfig.voiceProfile.anchors : []),
      aiConfig?.dialogueStyle?.tone,
      aiConfig?.voiceProfile?.tone,
      aiConfig?.backstory,
      aiConfig?.voiceProfile?.backstorySummary,
    ]
      .map((item) => String(item || '').trim().toLowerCase())
      .filter(Boolean)
      .join(' ');

    const tone = String(aiConfig?.dialogueStyle?.tone || aiConfig?.voiceProfile?.tone || '').trim().toLowerCase();

    if (/robot|android|machine|cyber|metal|synthetic|机械|机器人/i.test(descriptorText)) {
      return /gentle|nostalg|quiet|soft|melanch|dream|温柔|怀旧|安静/i.test(descriptorText) ? 'ballad' : 'echo';
    }

    if (/gentle|soft|quiet|calm|dream|melanch|nostalg|温柔|轻|安静|怀旧|忧郁/i.test(descriptorText)) {
      return /curious|playful|bright|sunny|好奇|活泼/i.test(descriptorText) ? 'coral' : 'ballad';
    }

    if (/confident|bold|tough|guarded|cynical|rebell|protective|sharp|冷硬|嘴硬|警惕|愤世嫉俗/i.test(descriptorText)) {
      return /charismatic|flirt|showy|perform|耀眼|张扬/i.test(descriptorText) ? 'onyx' : 'ash';
    }

    if (/formal|analytical|precise|wise|scholar|measured|理性|正式|克制|学者/i.test(descriptorText) || tone === 'formal') {
      return /warm|empathetic|patient|温和|共情/i.test(descriptorText) ? 'sage' : 'fable';
    }

    if (/playful|excited|sunny|curious|bubbly|energetic|乐观|好奇|兴奋|活泼/i.test(descriptorText)) {
      return /artistic|poetic|music|performer|艺术|诗意|歌手/i.test(descriptorText) ? 'verse' : 'nova';
    }

    if (/poetic|artistic|romantic|lyrical|诗意|文艺|浪漫/i.test(descriptorText) || tone === 'poetic' || tone === 'dreamy') {
      return 'shimmer';
    }

    if (/tired|casual|work|practical|plain|疲惫|务实|日常/i.test(descriptorText) || tone === 'tired' || tone === 'casual') {
      return 'alloy';
    }

    return pickVoiceFromPool(aiConfig?.id || aiConfig?.name || descriptorText, ['alloy', 'nova', 'coral', 'sage', 'ash', 'ballad']);
  }, [isOpenAiTtsModel, pickVoiceFromPool, remoteTtsVoice]);

  const pcm16ToWavBlob = (pcmBytes, sampleRate = 24000, channels = 1, trailingSilenceMs = 900) => {
    const bytesPerSample = 2;
    const blockAlign = channels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const wavHeaderSize = 44;
    const silenceBytes = Math.max(
      0,
      Math.round((sampleRate * blockAlign * trailingSilenceMs) / 1000)
    );
    const dataSize = pcmBytes.length + silenceBytes;
    const totalSize = wavHeaderSize + dataSize;

    const wav = new ArrayBuffer(totalSize);
    const view = new DataView(wav);
    let offset = 0;

    const writeStr = (s) => {
      for (let i = 0; i < s.length; i += 1) {
        view.setUint8(offset + i, s.charCodeAt(i));
      }
      offset += s.length;
    };

    writeStr('RIFF');
    view.setUint32(offset, totalSize - 8, true); offset += 4;
    writeStr('WAVE');
    writeStr('fmt ');
    view.setUint32(offset, 16, true); offset += 4;
    view.setUint16(offset, 1, true); offset += 2; // PCM
    view.setUint16(offset, channels, true); offset += 2;
    view.setUint32(offset, sampleRate, true); offset += 4;
    view.setUint32(offset, byteRate, true); offset += 4;
    view.setUint16(offset, blockAlign, true); offset += 2;
    view.setUint16(offset, 16, true); offset += 2; // bits per sample
    writeStr('data');
    view.setUint32(offset, dataSize, true); offset += 4;

    const body = new Uint8Array(wav, wavHeaderSize);
    body.set(pcmBytes);
    return new Blob([wav], { type: 'audio/wav' });
  };

  const getAudioContext = useCallback(async () => {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;

    if (!audioContextRef.current) {
      audioContextRef.current = new Ctx();
    }

    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    return audioContextRef.current;
  }, []);

  const pcm16ToFloat32 = useCallback((pcmBytes) => {
    const view = new DataView(
      pcmBytes.buffer,
      pcmBytes.byteOffset,
      pcmBytes.byteLength
    );
    const sampleCount = Math.floor(pcmBytes.byteLength / 2);
    const floats = new Float32Array(sampleCount);

    for (let i = 0; i < sampleCount; i += 1) {
      const sample = view.getInt16(i * 2, true);
      floats[i] = sample < 0 ? sample / 32768 : sample / 32767;
    }

    return floats;
  }, []);

  const decodeBase64AudioChunks = useCallback((chunks) => {
    const decodedChunks = [];
    let totalLength = 0;
    let carry = '';

    const pushDecodedBase64 = (base64Chunk) => {
      const cleanChunk = String(base64Chunk || '').replace(/\s+/g, '');
      if (!cleanChunk) return;

      const bin = atob(cleanChunk);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) {
        bytes[i] = bin.charCodeAt(i);
      }

      decodedChunks.push(bytes);
      totalLength += bytes.length;
    };

    for (const chunk of chunks) {
      const cleanChunk = String(chunk || '').replace(/\s+/g, '');
      if (!cleanChunk) continue;

      const mergedChunk = `${carry}${cleanChunk}`;
      const hasPadding = mergedChunk.includes('=');

      if (hasPadding) {
        try {
          pushDecodedBase64(mergedChunk);
          carry = '';
          continue;
        } catch {
          // fall through to partial decoding
        }
      }

      const decodableLength = mergedChunk.length - (mergedChunk.length % 4);
      if (decodableLength > 0) {
        const readyPart = mergedChunk.slice(0, decodableLength);
        const restPart = mergedChunk.slice(decodableLength);
        try {
          pushDecodedBase64(readyPart);
          carry = restPart;
          continue;
        } catch {
          // fall through to store everything in carry
        }
      }

      carry = mergedChunk;
    }

    if (carry) {
      const paddedCarry = carry.padEnd(carry.length + ((4 - (carry.length % 4)) % 4), '=');
      pushDecodedBase64(paddedCarry);
    }

    const merged = new Uint8Array(totalLength);
    let offset = 0;
    for (const bytes of decodedChunks) {
      merged.set(bytes, offset);
      offset += bytes.length;
    }

    return merged;
  }, []);

  const getPreferredChatAudioFormats = useCallback((model) => {
    if (/^openai\//.test(model) && isOpenRouterEndpoint) {
      if (remoteTtsFormat === 'mp3') {
        return ['mp3', 'pcm16'];
      }
      return ['mp3', 'pcm16'];
    }
    return [remoteTtsFormat === 'mp3' ? 'mp3' : 'pcm16'];
  }, [isOpenRouterEndpoint, remoteTtsFormat]);

  const stopRemoteAudio = useCallback(() => {
    if (activeFetchRef.current) {
      activeFetchRef.current.abort();
      activeFetchRef.current = null;
    }
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.onended = null;
        currentSourceRef.current.stop();
      } catch {
        // noop
      }
      currentSourceRef.current.disconnect?.();
      currentSourceRef.current = null;
    }
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
      } catch {
        // noop
      }
      currentAudioRef.current = null;
    }
  }, []);

  const waitForAudioReady = useCallback((audio) => {
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        audio.removeEventListener('canplaythrough', onReady);
        audio.removeEventListener('error', onError);
      };
      const onReady = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error('audio_failed_to_buffer'));
      };

      if (audio.readyState >= 4) {
        resolve();
        return;
      }

      audio.addEventListener('canplaythrough', onReady, { once: true });
      audio.addEventListener('error', onError, { once: true });
      audio.load();
    });
  }, []);

  const playAudioBlob = useCallback(async (blob, metadata = {}) => {
    if (!blob || blob.size === 0) {
      logTtsDebug('empty_audio_blob', metadata);
      return false;
    }

    if (metadata?.requestSeq && metadata.requestSeq !== requestSeqRef.current) {
      logTtsDebug('drop_stale_audio_blob', metadata);
      return false;
    }

    const audioUrl = URL.createObjectURL(blob);
    const audio = new Audio(audioUrl);
    audio.preload = 'auto';
    currentAudioRef.current = audio;

    await waitForAudioReady(audio);
    await audio.play();

    logTtsDebug('playback_started', metadata);

    audio.onended = () => {
      URL.revokeObjectURL(audioUrl);
      if (currentAudioRef.current === audio) {
        currentAudioRef.current = null;
      }
    };

    return true;
  }, [logTtsDebug, waitForAudioReady]);

  const playPcm16Bytes = useCallback(async (pcmBytes, metadata = {}) => {
    if (!pcmBytes || pcmBytes.length === 0) {
      logTtsDebug('empty_audio_blob', metadata);
      return false;
    }

    if (metadata?.requestSeq && metadata.requestSeq !== requestSeqRef.current) {
      logTtsDebug('drop_stale_pcm_audio', metadata);
      return false;
    }

    const audioContext = await getAudioContext();
    if (!audioContext) {
      const wavBlob = pcm16ToWavBlob(pcmBytes, 24000, 1);
      return playAudioBlob(wavBlob, metadata);
    }

    const sampleRate = 24000;
    const channelData = pcm16ToFloat32(pcmBytes);
    const trailingSeconds = 0.9;
    const trailingSamples = Math.round(sampleRate * trailingSeconds);
    const audioBuffer = audioContext.createBuffer(1, channelData.length + trailingSamples, sampleRate);
    audioBuffer.copyToChannel(channelData, 0, 0);

    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    currentSourceRef.current = source;

    source.onended = () => {
      if (currentSourceRef.current === source) {
        currentSourceRef.current.disconnect?.();
        currentSourceRef.current = null;
      }
    };

    source.start(0);
    logTtsDebug('playback_started', {
      ...metadata,
      engine: 'webaudio_pcm16',
      bytes: pcmBytes.length,
    });
    return true;
  }, [getAudioContext, logTtsDebug, pcm16ToFloat32, playAudioBlob]);

  const playSpeechEndpointTTS = useCallback(async (spokenScript, model, verbatimInstruction, voice, requestSeq) => {
    const speechResponseFormat = remoteTtsFormat === 'pcm16' ? 'wav' : remoteTtsFormat;
    const controller = new AbortController();
    activeFetchRef.current = controller;

    try {
      const response = await fetch(`${remoteTtsEndpoint}/audio/speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${remoteTtsApiKey}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'future-bartender-game',
        },
        body: JSON.stringify({
          model,
          voice,
          input: spokenScript,
          instructions: verbatimInstruction,
          response_format: speechResponseFormat,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        logTtsDebug('speech_endpoint_not_ok', {
          status: response.status,
          model,
          responseFormat: speechResponseFormat,
        });
        return false;
      }

      const audioBuffer = await response.arrayBuffer();
      const bytes = new Uint8Array(audioBuffer);
      const blobType =
        speechResponseFormat === 'mp3'
          ? 'audio/mpeg'
          : speechResponseFormat === 'wav'
            ? 'audio/wav'
            : speechResponseFormat === 'flac'
              ? 'audio/flac'
              : speechResponseFormat === 'opus'
                ? 'audio/ogg; codecs=opus'
                : 'audio/wav';
      const blob = new Blob([bytes], { type: blobType });

      const played = await playAudioBlob(blob, {
        model,
        voice,
        requestSeq,
        format: speechResponseFormat,
        bytes: bytes.length,
        transcript: spokenScript,
        endpoint: 'audio/speech',
      });

      activeFetchRef.current = null;
      return played;
    } catch (error) {
      logTtsDebug('speech_endpoint_error', {
        model,
        error: error?.message || String(error),
      });
      return false;
    }
  }, [
    logTtsDebug,
    playAudioBlob,
    remoteTtsApiKey,
    remoteTtsEndpoint,
    remoteTtsFormat,
  ]);

  const playRemoteTTS = useCallback(
    async (spokenScript, voice, requestSeq) => {
      if (!remoteTtsEnabled || !remoteTtsApiKey || !spokenScript) return false;

      const verbatimInstruction = [
        'You are a text-to-speech renderer.',
        'Read the provided text verbatim.',
        'Do not add, remove, summarize, paraphrase, translate, explain, roleplay, or answer.',
        'Speak exactly the text between <verbatim> and </verbatim>.',
        'If the text contains punctuation, preserve it only as natural speech pauses.',
        'Output audio only for that exact text.'
      ].join(' ');

      const verbatimPayload = [
        'Speak exactly this text and nothing else.',
        'Do not answer it, continue it, or describe it.',
        `TEXT: ${spokenScript}`
      ].join('\n');

      const processSseBlock = (block, audioChunks, textChunks) => {
        const lines = String(block || '')
          .split('\n')
          .filter((item) => item.trim().startsWith('data:'));

        for (const line of lines) {
          const payload = line.replace(/^data:\s*/, '').trim();
          if (!payload || payload === '[DONE]') continue;

          try {
            const parsed = JSON.parse(payload);
            const audioDelta = parsed?.choices?.[0]?.delta?.audio;
            const audioData = audioDelta?.data;
            const textDelta = audioDelta?.transcript;
            if (audioData) audioChunks.push(audioData);
            if (typeof textDelta === 'string' && textDelta.trim()) {
              textChunks.push(textDelta);
            }
          } catch {
            // ignore malformed SSE chunk
          }
        }
      };

      for (const model of remoteTtsModels) {
        if (/^openai\//.test(model) && !isOpenRouterEndpoint) {
          const played = await playSpeechEndpointTTS(spokenScript, model, verbatimInstruction, voice, requestSeq);
          if (played) {
            return true;
          }
        }

        for (const chatAudioFormat of getPreferredChatAudioFormats(model)) {
          const controller = new AbortController();
          activeFetchRef.current = controller;

          try {
            const response = await fetch(`${remoteTtsEndpoint}/chat/completions`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${remoteTtsApiKey}`,
                'HTTP-Referer': window.location.origin,
                'X-Title': 'future-bartender-game',
              },
              body: JSON.stringify({
                model,
                messages: [
                  { role: 'system', content: verbatimInstruction },
                  { role: 'user', content: verbatimPayload }
                ],
                modalities: ['text', 'audio'],
                audio: {
                  voice,
                  format: chatAudioFormat,
                },
                temperature: 0,
                max_tokens: Math.max(64, Math.ceil(spokenScript.length * 1.5)),
                stream: true,
              }),
              signal: controller.signal,
            });

            if (!response.ok) {
              logTtsDebug('response_not_ok', {
                status: response.status,
                model,
                voice,
                format: chatAudioFormat,
              });
              continue;
            }

            const reader = response.body?.getReader?.();
            if (!reader) continue;

            const decoder = new TextDecoder();
            const audioChunks = [];
            const textChunks = [];
            let buffer = '';

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });

              let splitIndex;
              while ((splitIndex = buffer.indexOf('\n\n')) >= 0) {
                const block = buffer.slice(0, splitIndex);
                buffer = buffer.slice(splitIndex + 2);
                processSseBlock(block, audioChunks, textChunks);
              }
            }

            buffer += decoder.decode();
            if (buffer.trim()) {
              processSseBlock(buffer, audioChunks, textChunks);
            }

            if (audioChunks.length === 0) {
              logTtsDebug('no_audio_chunks', { model, format: chatAudioFormat });
              continue;
            }

            const remoteTranscript = textChunks.join('').trim();
            if (strictTextSync) {
              if (!remoteTranscript) {
                logTtsDebug('drop_no_transcript', { model, spokenScript, format: chatAudioFormat });
                continue;
              }
              if (looksLikeInstructionReply(remoteTranscript)) {
                logTtsDebug('drop_instruction_reply_transcript', {
                  model,
                  voice,
                  format: chatAudioFormat,
                  spokenScript,
                  remoteTranscript,
                  requestSeq,
                });
                continue;
              }
              const expected = normalizeTtsComparisonText(spokenScript);
              const actual = normalizeTtsComparisonText(remoteTranscript);
              if (!isTranscriptCloseEnough(spokenScript, remoteTranscript)) {
                logTtsDebug('drop_transcript_mismatch', {
                  model,
                  voice,
                  format: chatAudioFormat,
                  spokenScript,
                  remoteTranscript,
                  expected,
                  actual,
                  requestSeq,
                });
                continue;
              }
            }

            const bytes = decodeBase64AudioChunks(audioChunks);
            if (requestSeq !== requestSeqRef.current) {
              logTtsDebug('drop_stale_stream_response', {
                model,
                voice,
                format: chatAudioFormat,
                requestSeq,
                currentRequestSeq: requestSeqRef.current,
              });
              continue;
            }
            const played = chatAudioFormat === 'mp3'
              ? await playAudioBlob(new Blob([bytes], { type: 'audio/mpeg' }), {
                  model,
                  voice,
                  requestSeq,
                  format: chatAudioFormat,
                  bytes: bytes.length,
                  transcript: remoteTranscript,
                })
              : await playPcm16Bytes(bytes, {
                  model,
                  voice,
                  requestSeq,
                  format: chatAudioFormat,
                  transcript: remoteTranscript,
                });
            if (!played) {
              continue;
            }

            activeFetchRef.current = null;
            return true;
          } catch (error) {
            logTtsDebug('play_remote_error', {
              model,
              voice,
              error: error?.message || String(error),
            });
            continue;
          }
        }
      }

      activeFetchRef.current = null;
      logTtsDebug('playback_dropped', { spokenScript });
      return false;
    },
    [
      logTtsDebug,
      remoteTtsApiKey,
      remoteTtsEnabled,
      remoteTtsEndpoint,
      remoteTtsModels,
      remoteTtsFormat,
      getPreferredChatAudioFormats,
      isOpenRouterEndpoint,
      decodeBase64AudioChunks,
      playAudioBlob,
      playPcm16Bytes,
      playSpeechEndpointTTS,
      normalizeTtsComparisonText,
      isTranscriptCloseEnough,
      looksLikeInstructionReply,
      strictTextSync,
    ]
  );

  const speak = useCallback(
    (text, aiConfig) => {
      void aiConfig;
      if (!text) return;

      stopRemoteAudio();
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }

      const cleanText = normalizeSpokenText(text);
      const spokenScript = createTtsScript(cleanText);
      const selectedVoice = resolveCharacterTtsVoice(aiConfig);
      const requestSeq = requestSeqRef.current + 1;
      requestSeqRef.current = requestSeq;

      if (!spokenScript) return;

      void (async () => {
        logTtsDebug('voice_selected', {
          requestSeq,
          characterId: aiConfig?.id || aiConfig?.name || 'unknown',
          voice: selectedVoice,
          tone: aiConfig?.dialogueStyle?.tone || aiConfig?.voiceProfile?.tone || '',
          spokenScript,
        });
        await playRemoteTTS(spokenScript, selectedVoice, requestSeq);
      })();
    },
    [createTtsScript, logTtsDebug, normalizeSpokenText, playRemoteTTS, resolveCharacterTtsVoice, stopRemoteAudio]
  );

  const stop = useCallback(() => {
    requestSeqRef.current += 1;
    stopRemoteAudio();
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, [stopRemoteAudio]);

  return { speak, stopTTS: stop };
};
