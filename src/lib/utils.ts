import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Generate random pastel background colors for target cards
export const generatePastelColor = (): string => {
  const pastelColors = [
    'bg-pink-100',
    'bg-purple-100', 
    'bg-indigo-100',
    'bg-blue-100',
    'bg-cyan-100',
    'bg-teal-100',
    'bg-emerald-100',
    'bg-green-100',
    'bg-lime-100',
    'bg-yellow-100',
    'bg-orange-100',
    'bg-red-100',
    'bg-rose-100',
    'bg-slate-100',
    'bg-gray-100',
    'bg-zinc-100',
    'bg-neutral-100',
    'bg-stone-100',
    'bg-amber-100',
    'bg-violet-100'
  ];
  
  return pastelColors[Math.floor(Math.random() * pastelColors.length)];
};
