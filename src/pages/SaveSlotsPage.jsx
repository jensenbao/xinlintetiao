import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createSlot,
  deleteSlot,
  listSlots,
  renameSlot,
} from '../utils/saveRepository.js';
import './SaveSlotsPage.css';

const formatTime = (value) => {
  if (!value) return 'Never entered';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return 'Unknown';
  }
};

const SaveSlotsPage = ({ onBack, onLoadSlot, onCreateAndStart }) => {
  const [slots, setSlots] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  const refreshSlots = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const list = await listSlots();
      setSlots(list);
    } catch {
      setError('Failed to load saves. Please make sure the local save service is running.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSlots();
  }, [refreshSlots]);

  const handleCreateOnly = useCallback(async () => {
    setIsCreating(true);
    setError('');
    try {
      await createSlot();
      await refreshSlots();
    } catch {
      setError('Failed to create save. Please try again later.');
    } finally {
      setIsCreating(false);
    }
  }, [refreshSlots]);

  const handleRename = useCallback(async (slot) => {
    const nextName = window.prompt('Enter a new save name:', slot.name || '');
    if (!nextName || !nextName.trim()) return;

    try {
      await renameSlot(slot.slotId, nextName.trim());
      await refreshSlots();
    } catch {
      setError('Rename failed.');
    }
  }, [refreshSlots]);

  const handleDelete = useCallback(async (slot) => {
    const confirmed = window.confirm(`Delete save "${slot.name || slot.slotId}"? This cannot be undone.`);
    if (!confirmed) return;

    try {
      await deleteSlot(slot.slotId);
      await refreshSlots();
    } catch {
      setError('Delete failed.');
    }
  }, [refreshSlots]);

  const content = useMemo(() => {
    if (isLoading) {
      return <div className="save-slots-empty">Loading saves...</div>;
    }

    if (slots.length === 0) {
      return (
        <div className="save-slots-empty">
          <p>No saves available.</p>
          <button className="save-slots-primary" onClick={onCreateAndStart}>Create a save and start</button>
        </div>
      );
    }

    return (
      <div className="save-slots-list">
        {slots.map((slot) => (
          <article key={slot.slotId} className="save-slot-card">
            <div className="save-slot-main">
              <h3>{slot.name || slot.slotId}</h3>
              <p>Day: {slot.summary?.day || 1}</p>
              <p>Last updated: {formatTime(slot.updatedAt || slot.summary?.updatedAt)}</p>
            </div>
            <div className="save-slot-actions">
              <button onClick={() => onLoadSlot(slot.slotId)}>Load</button>
              <button onClick={() => handleRename(slot)}>Rename</button>
              <button className="danger" onClick={() => handleDelete(slot)}>Delete</button>
            </div>
          </article>
        ))}
      </div>
    );
  }, [isLoading, slots, onCreateAndStart, onLoadSlot, handleRename, handleDelete]);

  return (
    <div className="save-slots-page">
      <header className="save-slots-header">
        <button className="save-slots-back" onClick={onBack}>Back</button>
        <h1>Load Save</h1>
        <button className="save-slots-primary" disabled={isCreating} onClick={handleCreateOnly}>
          {isCreating ? 'Creating...' : 'New Save'}
        </button>
      </header>

      {error && <div className="save-slots-error">{error}</div>}

      {content}
    </div>
  );
};

export default SaveSlotsPage;
