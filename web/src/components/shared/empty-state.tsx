import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { FolderFloat } from './motion/folder-float';
import { Mascot, type MascotPose } from './mascot/mascot';

/** An empty screen is an invitation to act: say what goes here and offer the action. */
export function EmptyState({ icon, mascot, title, description, action }: { icon: LucideIcon; mascot?: MascotPose; title: string; description: string; action?: ReactNode }) {
  return (
    <Empty className="motion-enter border border-dashed">
      <EmptyHeader>
        {mascot ? <Mascot pose={mascot} className="sticker sticker-in mb-2 size-28 [--tilt:-4deg]" /> : <FolderFloat icon={icon} />}
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}
