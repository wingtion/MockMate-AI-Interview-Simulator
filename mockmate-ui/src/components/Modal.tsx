import { useEffect, useRef } from 'react';

// Thin wrapper over the native <dialog> element. showModal() gives us focus
// containment, Escape handling, inertness of the page behind, and focus
// restoration to the trigger on close, without a focus-trap library.
export default function Modal({
    open,
    onClose,
    label,
    className = '',
    dismissible = true,
    role,
    children,
}: {
    open: boolean;
    onClose?: () => void;
    label: string;
    className?: string;
    dismissible?: boolean; // false = Escape and backdrop clicks do nothing (e.g. while loading)
    role?: 'dialog' | 'alertdialog';
    children: React.ReactNode;
}) {
    const ref = useRef<HTMLDialogElement>(null);

    useEffect(() => {
        const dialog = ref.current;
        if (!dialog) return;
        if (open && !dialog.open) dialog.showModal();
        else if (!open && dialog.open) dialog.close();
    }, [open]);

    // Close if the dialog unmounts while open (e.g. route change).
    useEffect(() => {
        const dialog = ref.current;
        return () => { if (dialog?.open) dialog.close(); };
    }, []);

    const handleCancel = (e: React.SyntheticEvent<HTMLDialogElement>) => {
        // Escape: keep React state as the source of truth.
        e.preventDefault();
        if (dismissible) onClose?.();
    };

    const handleClick = (e: React.MouseEvent<HTMLDialogElement>) => {
        // A click whose target is the <dialog> itself and lands outside its box hit the backdrop.
        if (!dismissible || e.target !== e.currentTarget) return;
        const r = e.currentTarget.getBoundingClientRect();
        const outside = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
        if (outside) onClose?.();
    };

    return (
        <dialog
            ref={ref}
            className={`modal ${className}`}
            aria-label={label}
            role={role}
            onCancel={handleCancel}
            onClick={handleClick}
        >
            {open && children}
        </dialog>
    );
}
