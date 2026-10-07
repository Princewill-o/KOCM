'use client';
import { useEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { Tab } from '@/lib/access';
import './floating-nav.css';

type Item = { id: Tab; label: string; icon: LucideIcon };
type Props = { items: Item[]; active: Tab; unread: number; onSelect: (tab: Tab) => void };

export default function FloatingNav({ items, active, unread, onSelect }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const buttons = useRef(new Map<Tab, HTMLButtonElement>());
  const [indicator, setIndicator] = useState({ x: 0, y: 0, visible: false });
  const itemKey = items.map(item => item.id).join(',');

  useEffect(() => {
    const update = () => {
      const button = buttons.current.get(active);
      if (!button) return;
      setIndicator({ x: button.offsetLeft + (button.offsetWidth - 44) / 2, y: button.offsetTop - 6, visible: true });
      const viewport = scroller.current;
      if (viewport) {
        const left = button.offsetLeft;
        const right = left + button.offsetWidth;
        if (left < viewport.scrollLeft + 12 || right > viewport.scrollLeft + viewport.clientWidth - 12) {
          viewport.scrollTo({ left: Math.max(0, left - (viewport.clientWidth - button.offsetWidth) / 2), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
        }
      }
    };
    const frame = requestAnimationFrame(update);
    const observer = new ResizeObserver(update);
    if (track.current) observer.observe(track.current);
    if (scroller.current) observer.observe(scroller.current);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [active, itemKey]);

  if (!items.length) return null;
  return <nav className="floating-nav" aria-label="Main navigation">
    <div className="floating-nav-scroller" ref={scroller}>
      <div className="floating-nav-track" ref={track}>
        <span aria-hidden="true" className="floating-nav-indicator" style={{ transform: `translate3d(${indicator.x}px, ${indicator.y}px, 0)`, opacity: indicator.visible ? 1 : 0 }} />
        {items.map(({ id, label, icon: Icon }) => <button
          type="button" key={id} ref={element => { if (element) buttons.current.set(id, element); else buttons.current.delete(id); }}
          className={`floating-nav-item${active === id ? ' is-active' : ''}`}
          aria-current={active === id ? 'page' : undefined}
          aria-label={id === 'notifications' && unread ? `${label}, ${unread} unread` : label}
          onClick={() => onSelect(id)} title={label}
        >
          <span className="floating-nav-icon"><Icon size={20} strokeWidth={1.8} aria-hidden="true" />{id === 'notifications' && unread > 0 && <span className="floating-nav-badge">{unread > 99 ? '99+' : unread}</span>}</span>
          <span className="floating-nav-label">{label}</span>
        </button>)}
      </div>
    </div>
  </nav>;
}
