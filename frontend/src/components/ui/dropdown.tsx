import React, { useState, useRef, useEffect, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

// Типи для пунктів меню
interface DropdownItem {
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'danger';
  separator?: boolean;
}

interface UniversalDropdownProps {
  trigger: ReactNode; // Що саме відкриває меню (кнопка, аватар тощо)
  items: DropdownItem[]; // Масив пунктів
  align?: 'left' | 'right'; // Вирівнювання меню
  className?: string; // Додаткові класи для контейнера
}

const Dropdown = ({ 
  trigger, 
  items, 
  align = 'right', 
  className = '' 
}: UniversalDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Закриття при кліку ззовні
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      {/* Trigger */}
      <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
        {trigger}
      </div>

      {/* Dropdown Panel */}
      {isOpen && (
        <div 
          className={`
            absolute z-50 mt-2 w-56 rounded-md border border-gray-200 bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none
            ${align === 'right' ? 'right-0' : 'left-0'}
            animate-in fade-in zoom-in duration-75
          `}
        >
          <div className="py-1">
            {items.map((item, index) => (
              <React.Fragment key={index}>
                {item.separator && <div className="my-1 h-[1px] bg-gray-100" />}
                <button
                  onClick={() => {
                    item.onClick?.();
                    setIsOpen(false);
                  }}
                  className={`
                    flex w-full items-center px-4 py-2 text-sm transition-colors
                    ${item.variant === 'danger' 
                      ? 'text-red-600 hover:bg-red-50' 
                      : 'text-gray-700 hover:bg-gray-100'}
                  `}
                >
                  {item.icon && <span className="mr-3 h-4 w-4">{item.icon}</span>}
                  {item.label}
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dropdown;