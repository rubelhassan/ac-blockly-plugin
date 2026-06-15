/**
 * Practice programs for the Keyboard Trainer's live sandbox.
 *
 * Movement, editing, and "where can I go" shortcuts only mean anything when
 * there are real blocks under the cursor. Rather than borrow one of the demo's
 * teaching tasks (which are large, multi-stack, and tuned for a different
 * lesson), the trainer loads this small, purpose-built stack: one container
 * block (a repeat loop) with two children inside it and a sibling after it.
 *
 * That shape is deliberate — from the centre block every core cursor move is
 * valid, so the learner always sees the cursor actually move:
 *   W (previous) / A (out to parent) / S (next) / D (in to a child value).
 *
 * The block ids are stable and referenced by PRACTICE_ANCHORS so the live
 * adapter can park the cursor on a known block before each drill.
 */

export const NAVIGATION_PRACTICE_XML = `
<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="controls_repeat_ext" id="practice-loop" x="60" y="60">
    <value name="TIMES">
      <block type="math_number" id="practice-times"><field name="NUM">3</field></block>
    </value>
    <statement name="DO">
      <block type="text_print" id="practice-print-1">
        <value name="TEXT">
          <block type="text" id="practice-text-1"><field name="TEXT">First step</field></block>
        </value>
        <next>
          <block type="text_print" id="practice-print-2">
            <value name="TEXT">
              <block type="text" id="practice-text-2"><field name="TEXT">Second step</field></block>
            </value>
          </block>
        </next>
      </block>
    </statement>
    <next>
      <block type="text_print" id="practice-print-after">
        <value name="TEXT">
          <block type="text" id="practice-text-after"><field name="TEXT">All done</field></block>
        </value>
      </block>
    </next>
  </block>
</xml>`;

/**
 * A spoken, structural walk-through of NAVIGATION_PRACTICE_XML for BVI learners.
 * Announced when the trainer drops the learner into the practice stack so they
 * know what is on the workspace before being asked to move around it — what
 * blocks exist, how they nest, and what each one says.
 */
export const NAVIGATION_PRACTICE_DESCRIPTION =
  'Here is the practice program. At the top is a repeat loop set to run three ' +
  'times. Nested inside the loop are two print blocks: the first prints the ' +
  'text "First step", the second prints "Second step". After the loop, on its ' +
  'own, is a third print block that prints "All done".';

/**
 * Named cursor anchors → block ids in NAVIGATION_PRACTICE_XML. The trainer asks
 * the adapter to place the cursor at one of these before a movement drill.
 * Each move is only valid from certain spots (you cannot go "up" from the top
 * block), so every drill parks the cursor on an anchor where its key really
 * moves:
 *   firstChild  - first print in the loop; S (next) and D (in) move from here
 *   secondChild - second print; W (previous) moves up to the first
 *   value       - the number in the loop counter; A (out) moves up to the loop
 *   container   - the repeat loop itself
 *   sibling     - the print after the loop
 */
export const PRACTICE_ANCHORS = {
  center: 'practice-print-1',
  container: 'practice-loop',
  firstChild: 'practice-print-1',
  secondChild: 'practice-print-2',
  value: 'practice-times',
  sibling: 'practice-print-after'
};

/**
 * Friendly spoken names for the block types used above, so a cue can say where
 * the cursor landed ("you are now on the repeat loop") instead of a raw type.
 */
export const BLOCK_FRIENDLY_NAMES = {
  controls_repeat_ext: 'the repeat loop',
  text_print: 'a print block',
  text: 'a text value',
  math_number: 'a number'
};
