import { useRef } from 'react';

// Presentation identities stay out of saved engineering data. Repeated models
// are separate rows, so sorting does not reuse the DOM for a different position.
export default function useSequenceKeys(sequence) {
  const state = useRef({ sequence: null, rows: [], serial: 0 });
  if (state.current.sequence !== sequence) {
    const pools = new Map();
    for (const row of state.current.rows) {
      if (!pools.has(row.name)) pools.set(row.name, []);
      pools.get(row.name).push(row);
    }
    state.current.rows = sequence.map(
      (name) => pools.get(name)?.shift() || { name, id: `sequence-${++state.current.serial}` },
    );
    state.current.sequence = sequence;
  }
  return {
    ids: state.current.rows.map((row) => row.id),
    move(from, to) {
      const rows = [...state.current.rows];
      rows.splice(to, 0, ...rows.splice(from, 1));
      state.current.rows = rows;
    },
    remove(index) {
      state.current.rows.splice(index, 1);
    },
    insert(name, index) {
      state.current.rows.splice(index, 0, { name, id: `sequence-${++state.current.serial}` });
    },
  };
}
