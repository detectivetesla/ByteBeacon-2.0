import React from 'react';
import { Modal } from '../Modal/Modal.js';
import { Button } from '../Button/Button.js';
import { RotateCcw } from 'lucide-react';

export interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  activeCount?: number;
  onReset?: () => void;
  onApply?: () => void;
  children: React.ReactNode;
}

export const FilterDrawer: React.FC<FilterDrawerProps> = ({
  isOpen,
  onClose,
  title = 'Filters',
  activeCount = 0,
  onReset,
  onApply,
  children,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={activeCount > 0 ? `${title} (${activeCount})` : title}
      maxWidth="480px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 'var(--space-2) 0' }}>
        {children}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          gap: '0.5rem',
          marginTop: 'var(--space-4)',
          paddingTop: 'var(--space-4)',
          borderTop: '1px solid var(--border-card-subtle)',
        }}
      >
        {onReset && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onReset();
            }}
            leftIcon={<RotateCcw size={13} />}
          >
            Reset
          </Button>
        )}
        <Button
          variant="primary"
          size="sm"
          style={{ marginLeft: 'auto' }}
          onClick={() => {
            onApply?.();
            onClose();
          }}
        >
          Apply Filters
        </Button>
      </div>
    </Modal>
  );
};
