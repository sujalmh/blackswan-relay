import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function truncateHash(hash: string, chars = 10) {
  if (!hash) return "";
  return `${hash.slice(0, chars)}…${hash.slice(-4)}`;
}

export function formatSepoliaLink(tx?: string, address?: string) {
  if (tx) return `https://sepolia.etherscan.io/tx/${tx}`;
  if (address) return `https://sepolia.etherscan.io/address/${address}`;
  return "#";
}
