import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { List, X } from '@phosphor-icons/react';

export interface NavItem {
    label: string;
    to?: string;                                  // router link
    href?: string;                                // in-page anchor
    onClick?: (e: React.MouseEvent) => void;      // e.g. smooth-scroll to an anchor
}

// Sticky site navbar shared by Home and Dashboard. Under 600px the text links
// collapse into a Menu button (the "Start interview" key always stays visible).
export default function SiteNav({ items }: { items: NavItem[] }) {
    const [open, setOpen] = useState(false);
    const menuId = useId();
    const navRef = useRef<HTMLElement>(null);

    // Close on Escape or on a press outside the navbar.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        const onDown = (e: PointerEvent) => {
            if (navRef.current && !navRef.current.contains(e.target as Node)) setOpen(false);
        };
        window.addEventListener('keydown', onKey);
        window.addEventListener('pointerdown', onDown);
        return () => {
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('pointerdown', onDown);
        };
    }, [open]);

    const renderItem = (item: NavItem, className: string) =>
        item.to ? (
            <Link key={item.label} to={item.to} className={className} onClick={() => setOpen(false)}>
                {item.label}
            </Link>
        ) : (
            <a
                key={item.label}
                href={item.href}
                className={className}
                onClick={(e) => { item.onClick?.(e); setOpen(false); }}
            >
                {item.label}
            </a>
        );

    return (
        <nav className="navbar" aria-label="Main" ref={navRef}>
            <Link to="/" className="logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                <span className="logo-mark" aria-hidden="true">M</span>
                MockMate
            </Link>

            <div className="nav-links">
                {items.map((item) => renderItem(item, 'nav-link'))}
                <Link to="/interview/Standard" className="nav-link nav-cta">Start interview</Link>
                <button
                    type="button"
                    className="nav-menu-btn"
                    aria-expanded={open}
                    aria-controls={menuId}
                    onClick={() => setOpen((o) => !o)}
                >
                    {open ? <X size={20} aria-hidden="true" /> : <List size={20} aria-hidden="true" />}
                    <span className="sr-only">Menu</span>
                </button>
            </div>

            <div id={menuId} className="nav-menu" hidden={!open}>
                {items.map((item) => renderItem(item, 'nav-menu-link'))}
            </div>
        </nav>
    );
}
