import { CloseOutlined, SearchOutlined } from '@ant-design/icons';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

export type CommandItem = {
  id: string;
  label: string;
  description: string;
  group: string;
  icon: ReactNode;
  shortcut?: string;
  keywords?: string;
  onSelect: () => void;
};

export function CommandPalette({
  open,
  commands,
  onClose,
}: {
  open: boolean;
  commands: CommandItem[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return commands;
    return commands.filter((command) =>
      `${command.label} ${command.description} ${command.group} ${command.keywords ?? ''}`
        .toLowerCase()
        .includes(normalized),
    );
  }, [commands, query]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    queueMicrotask(() => inputRef.current?.focus());
  }, [open]);

  if (!open) return null;

  function select(command: CommandItem | undefined) {
    if (!command) return;
    command.onSelect();
    onClose();
  }

  return (
    <div className="command-backdrop" onMouseDown={onClose}>
      <div aria-label="빠른 이동" aria-modal="true" className="command-palette" onMouseDown={(event) => event.stopPropagation()} role="dialog">
        <div className="command-search">
          <SearchOutlined />
          <input
            aria-label="명령 검색"
            onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActiveIndex((index) => Math.min(index + 1, filtered.length - 1));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActiveIndex((index) => Math.max(index - 1, 0));
              } else if (event.key === 'Enter') {
                event.preventDefault();
                select(filtered[activeIndex]);
              } else if (event.key === 'Escape') {
                onClose();
              }
            }}
            placeholder="화면, 종목 작업, 명령 검색…"
            ref={inputRef}
            value={query}
          />
          <button aria-label="명령 팔레트 닫기" onClick={onClose} type="button"><CloseOutlined /></button>
        </div>
        <div className="command-results">
          {filtered.map((command, index) => (
            <button
              className={index === activeIndex ? 'active' : ''}
              key={command.id}
              onClick={() => select(command)}
              onMouseEnter={() => setActiveIndex(index)}
              type="button"
            >
              <span className="command-icon">{command.icon}</span>
              <span className="command-copy"><strong>{command.label}</strong><small>{command.description}</small></span>
              <span className="command-group">{command.group}</span>
              {command.shortcut && <kbd>{command.shortcut}</kbd>}
            </button>
          ))}
          {filtered.length === 0 && <div className="command-empty">일치하는 명령이 없습니다.</div>}
        </div>
        <div className="command-footer"><span>↑↓ 이동</span><span>Enter 실행</span><span>Esc 닫기</span></div>
      </div>
    </div>
  );
}
