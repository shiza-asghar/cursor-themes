// Runegrove Workshop — sample TypeScript manuscript.
// Open this file with: Reopen Editor With → Runegrove Guild Workshop.

type Manuscript = {
  title: string;
  language: string;
  pinned: boolean;
};

const manuscripts: Manuscript[] = [
  { title: 'A little magic', language: 'TypeScript', pinned: true },
  { title: 'The quiet worktable', language: 'Markdown', pinned: false },
];

export function findManuscripts(query: string): Manuscript[] {
  const search = query.trim().toLocaleLowerCase();

  return manuscripts.filter(({ title }) => {
    return title.toLocaleLowerCase().includes(search);
  });
}

export function pinManuscript(title: string): boolean {
  const manuscript = manuscripts.find(item => item.title === title);
  if (!manuscript) return false;

  manuscript.pinned = true;
  return true;
}

// The host document remains the source of truth.
// Ctrl/Cmd+S saves; Native editor restores the full Cursor experience.
const readingList = findManuscripts('magic');
console.log(readingList);
