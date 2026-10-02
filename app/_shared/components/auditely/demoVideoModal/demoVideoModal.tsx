// app/_shared/components/auditely/demoVideoModal/demoVideoModal.tsx

'use client';

import { Modal } from '@/app/_shared/components/ui/modal/modal';

interface DemoVideoModalProps {
  /** The walkthrough's player (DemoLinks.videoPlayerUrl) */
  playerUrl: string;
  onClose: () => void;
}

/** Plays the recorded walkthrough over the public demo. Mounted only once asked for, so the player loads on the click. */
export function DemoVideoModal({ playerUrl, onClose }: DemoVideoModalProps) {
  return (
    <Modal isOpen onClose={onClose} size="xl">
      <Modal.Header title="A live search and audit" onClose={onClose} />
      <div className="aspect-video min-h-0 w-full bg-black">
        <iframe
          src={playerUrl}
          title="Auditely walkthrough video"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          className="h-full w-full border-0"
        />
      </div>
    </Modal>
  );
}
