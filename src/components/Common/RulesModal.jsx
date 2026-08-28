import React from 'react';
import './RulesModal.css';

/**
 * Game rules modal
 */
const RulesModal = ({ onClose }) => {
  return (
    <div className="rules-modal-overlay" onClick={onClose}>
      <div className="rules-modal" onClick={(e) => e.stopPropagation()}>
        <button className="rules-close" onClick={onClose}>×</button>
        
        <h2 className="rules-title">🍸 Resonant Sips - Game Rules</h2>
        
        <div className="rules-content">
          <section className="rule-section endless-mode">
            <h3>🌟 Endless Mode</h3>
            <ul>
              <li>Each customer needs <strong>3 successful cocktails</strong> before leaving satisfied</li>
              <li>Customers start with <strong>0% trust</strong>; both dialogue and mixing performance affect later interactions</li>
              <li>Successful cocktails grant <strong>💰 coin income</strong> (amount scales with recipe satisfaction)</li>
              <li>After serving the current customer, you enter <strong>day settlement</strong> and can buy items in the shop</li>
              <li>A new customer arrives the next day, so the challenge continues</li>
            </ul>
          </section>

          <section className="rule-section">
            <h3>🎯 Goal</h3>
            <p>Run your cyber bar. Talk with AI customers, read the <strong>true feelings behind their surface emotions</strong>, then mix a cocktail that matches the target conditions to earn coins and unlock more content.</p>
          </section>

          <section className="rule-section">
            <h3>💬 Dialogue System</h3>
            <ul>
              <li><strong>Quick options</strong>: click 3-4 preset lines to advance the conversation fast</li>
              <li><strong>Custom input</strong>: type your own response for deeper interaction</li>
              <li><strong>Trust system</strong>: the more honest and meaningful the talk, the more trust you gain</li>
              <li>Good dialogue raises trust (+3% to +8%); shallow replies reduce it (-3% to -8%)</li>
            </ul>
          </section>

          <section className="rule-section">
            <h3>🎭 Emotion Reading & Guessing</h3>
            <ul>
              <li><strong>Surface emotion</strong>: what the customer shows at first glance</li>
              <li><strong>True emotion</strong>: what they actually feel inside (must be unlocked by guessing)</li>
              <li><strong>Guess emotion</strong>: click the "🎯 Guess True Emotion" button and choose what you believe is real</li>
              <li><strong>Correct guess</strong>: unlocks mixing + trust +10%</li>
              <li><strong>Wrong guess</strong>: trust <span className="danger">-5% to -7%</span> (penalty increases on repeated misses)</li>
            </ul>
          </section>

          <section className="rule-section">
            <h3>🍹 Mixing Rules (Core Gameplay)</h3>
            <p style={{ fontSize: '0.95em', marginBottom: '12px', opacity: 0.9 }}>
              <strong>❗You must guess the true emotion correctly before the mixing station unlocks.</strong>
            </p>
            <h4 style={{ fontSize: '1em', marginTop: '15px', marginBottom: '8px' }}>📋 Mixing Flow (6 Steps)</h4>
            <ul>
              <li><strong>Step 1: Choose a glass</strong> - Glass type defines base capacity (2-4 portions)</li>
              <li><strong>Step 2: Add ice</strong> - Affects thickness, sweetness, and strength</li>
              <li><strong>Step 3: Mix base liquids</strong> (core) - Add spirits, juices, liqueurs, and others</li>
              <li><strong>Step 4: Add garnish ingredients</strong> (optional) - Syrup, lavender, lemon slice, etc.</li>
              <li><strong>Step 5: Add decoration</strong> (optional) - Mint leaf, cherry, gold leaf, etc.</li>
              <li><strong>Step 6: Serve</strong> - Check whether the recipe meets the target</li>
            </ul>

            <h4 style={{ fontSize: '1em', marginTop: '15px', marginBottom: '8px' }}>🎯 3D Target Conditions</h4>
            <p style={{ fontSize: '0.9em', marginBottom: '8px', opacity: 0.85 }}>
              After a correct guess, the system generates <strong>three target dimensions</strong> based on true emotion:
            </p>
            <ul>
              <li><strong>🫗 Thickness</strong>: body/heaviness of texture (-10 to +10)</li>
              <li><strong>🍬 Sweetness</strong>: sweetness level (negative means sour/bitter) (-10 to +10)</li>
              <li><strong>🔥 Strength</strong>: alcohol intensity (0 to 15)</li>
            </ul>
            <p style={{ fontSize: '0.9em', marginTop: '8px', opacity: 0.85 }}>
              Each dimension shows a target range (for example: Thickness 3-5). Reach it by choosing the right <strong>base liquids, ice, ingredients, and decorations</strong>.
            </p>

            <h4 style={{ fontSize: '1em', marginTop: '15px', marginBottom: '8px' }}>🧪 Base Liquid System (Core)</h4>
            <ul>
              <li><strong>Categories</strong>: spirits (high strength), juice (sweetness tuning), liqueur (flavor tuning), others (special)</li>
              <li><strong>Portion limit</strong>: add 2-4 portions depending on glass type</li>
              <li><strong>Per-item cap</strong>: each base liquid can be added up to 2 portions</li>
              <li><strong>Dimension contribution</strong>: each liquid contributes differently to thickness/sweetness/strength</li>
              <li>Example: Vodka (thickness 0, sweetness -1, strength +2), Orange juice (thickness +1, sweetness +2, strength 0)</li>
            </ul>
          </section>

          <section className="rule-section bonus-guide">
            <h3>🎯 Success Conditions</h3>
            <ul>
              <li><strong>Core rule</strong>: all three dimensions must be inside target range</li>
              <li><strong>Satisfaction</strong>: the closer to target center, the higher the score (0-100%)</li>
              <li><strong>Income formula</strong>: base price × satisfaction multiplier (0.8-1.2x)</li>
              <li><strong>Failure penalty</strong>: out-of-range cocktails reduce trust by -10%</li>
            </ul>
          </section>

          <section className="rule-section combo-special">
            <h3>✨ Item Effects</h3>
            <h4 style={{ fontSize: '1em', marginTop: '10px', marginBottom: '8px' }}>🧊 Ice Effects</h4>
            <ul>
              <li><strong>No ice</strong>: strength +1</li>
              <li><strong>Light ice</strong>: no extra effect</li>
              <li><strong>Sphere ice</strong>: thickness +1</li>
              <li><strong>Extra ice</strong>: strength -1</li>
              <li><strong>Heavy ice</strong>: thickness -1, strength -2</li>
              <li><strong>Dry ice</strong>: thickness -2 (visual effect)</li>
            </ul>
            
            <h4 style={{ fontSize: '1em', marginTop: '15px', marginBottom: '8px' }}>🍋 Ingredient Effects (Common)</h4>
            <ul>
              <li><strong>Syrup</strong>: sweetness +2</li>
              <li><strong>Honey</strong>: thickness +1, sweetness +1</li>
              <li><strong>Lavender</strong>: thickness -1, sweetness +1 (healing tone)</li>
              <li><strong>Mint leaf</strong>: sweetness -1 (refreshing)</li>
              <li><strong>Bitters</strong>: sweetness -2 (bitter tone)</li>
            </ul>
            
            <h4 style={{ fontSize: '1em', marginTop: '15px', marginBottom: '8px' }}>🍒 Decoration Effects</h4>
            <ul>
              <li>Most decorations are <strong>purely visual</strong> and do not change dimension values</li>
              <li><strong>Gold leaf</strong>: strength +1 (luxury feel)</li>
              <li><strong>Chili</strong>: strength +2 (intense feel)</li>
            </ul>
          </section>

          <section className="rule-section">
            <h3>🎉 Golden Combos (Discovery)</h3>
            <p style={{ fontSize: '0.9em', marginBottom: '10px', opacity: 0.85 }}>
              Specific item combinations trigger golden combos and are recorded in the codex. Examples:
            </p>
            <ul>
              <li>💚 <strong>Healing Set</strong>: Lavender + Mint Leaf + Light Ice</li>
              <li>🕰️ <strong>Time Rewind</strong>: Syrup + Mule Mug + Sphere Ice</li>
              <li>🦁 <strong>Braveheart Drink</strong>: Gold Leaf + Extra Ice + Coupe</li>
              <li>🌫️ <strong>Misty Abyss</strong>: Dry Ice + Smoke Bubble + Skull Cup</li>
              <li>💡 Discover more combinations to complete the codex.</li>
            </ul>
          </section>

          <section className="rule-section">
            <h3>🏆 Unlock System</h3>
            <ul>
              <li><strong>Shop purchase</strong>: use coins for new glasses, ice, base liquids, ingredients, and decorations</li>
              <li><strong>5 successes</strong> → automatically unlocks a new glass type</li>
              <li><strong>Prioritize base liquids</strong>: more liquid variety means more flexible mixing</li>
              <li><strong>Ingredients and decorations</strong>: fine-tune dimension values for precise targets</li>
            </ul>
          </section>

          <section className="rule-section guess-guide">
            <h3>💡 Tips</h3>
            <ul>
              <li><strong>Be patient in dialogue</strong>: multiple rounds build trust and unlock deeper responses</li>
              <li><strong>Read tone carefully</strong>: combine wording and mood to infer the closest emotions</li>
              <li><strong>Confirm decisively</strong>: guessing itself is not the end; mixing quality is what matters</li>
              <li><strong>Read targets first</strong>: after a correct guess, check all ranges before choosing liquids</li>
              <li><strong>Balance all dimensions</strong>: base liquids are core; ice/ingredients/decorations are fine-tuning</li>
              <li><strong>Save good recipes</strong>: successful mixes become useful templates</li>
              <li><strong>Adjust flexibly</strong>: if one attempt fails, tweak and retry (watch trust level)</li>
            </ul>
          </section>

          <section className="rule-section recipe-guide">
            <h3>⚠️ Notes</h3>
            <ul>
              <li>You must <strong>guess emotion correctly first</strong> to unlock the mixing station</li>
              <li><strong>Very short or repetitive replies</strong> reduce trust (-3% to -8%)</li>
              <li><strong>Mixing failures</strong> reduce trust (-10%)</li>
              <li><strong>Low trust</strong> makes customers less open and affects feedback quality</li>
              <li>Build trust through conversation first, then infer emotion from the full context</li>
            </ul>
          </section>

          <section className="rule-section combo-guide">
            <h3>🍸 Mixing Example</h3>
            <p style={{ fontSize: '0.9em', marginBottom: '10px', opacity: 0.8 }}>Example target: Thickness 2-4, Sweetness 1-3, Strength 4-6</p>
            <ul>
              <li><strong>Plan 1</strong>: Whiskey×2 (thick +4, sweet 0, strong +6) + Extra Ice (strong -1) → thick 4, sweet 0, strong 5 ❌ sweetness too low</li>
              <li><strong>Plan 2</strong>: Whiskey×1 + Orange Juice×1 (thick +3, sweet +2, strong +3) + Syrup (sweet +2) → thick 3, sweet 4, strong 3 ❌ strength too low</li>
              <li><strong>Plan 3</strong>: Whiskey×1 + Rum×1 (thick +3, sweet +1, strong +5) + Syrup (sweet +2) → thick 3, sweet 3, strong 5 ✓ all conditions met</li>
              <li>💡 <strong>Tip</strong>: build the core with base liquids first, then fine-tune with ingredients/ice</li>
            </ul>
          </section>

          <section className="rule-section" style={{ borderTop: '2px solid rgba(138, 101, 255, 0.3)', paddingTop: '20px' }}>
            <h3>🎮 Shortcuts</h3>
            <ul>
              <li><strong>ESC</strong>: close the current modal</li>
              <li><strong>Enter</strong>: send dialogue (while input is focused)</li>
              <li><strong>?</strong>: open rules/help (main interface)</li>
            </ul>
          </section>
        </div>

        <button className="rules-start-button" onClick={onClose}>
          Start Game
        </button>
      </div>
    </div>
  );
};

export default RulesModal;
