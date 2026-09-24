import React from 'react';
import { UserCheck } from 'lucide-react';

interface Props {
  name: string;
  email: string;
  isAdmin: boolean;
  count: number;
}

export default function FilerBanner({ name, email, isAdmin, count }: Props) {
  const scope = isAdmin ? 'all employees' : `${count} employee${count !== 1 ? 's' : ''}`;
  return (
    <div
      className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
      style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}
    >
      <UserCheck size={13} className="text-green-600 shrink-0" />
      <span className="text-green-700">
        Filing as <span className="font-semibold">{name}</span> ({email}) · {scope}
      </span>
    </div>
  );
}
