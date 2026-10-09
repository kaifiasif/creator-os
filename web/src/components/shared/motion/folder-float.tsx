import type { LucideIcon } from 'lucide-react';

/** An empty screen's picture: a folder with two pages drifting inside, which open up on hover. */
export function FolderFloat({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <div aria-hidden className="folder motion-pop">
      <div className="folder-back" />
      <div className="folder-paper" />
      <div className="folder-paper" />
      <div className="folder-front">
        <Icon />
      </div>
    </div>
  );
}
