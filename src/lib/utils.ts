import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function mod(a: number, n: number) {
  return ((a % n) + n) % n;
}

export function reverse<T>(array: T[], start: number, end: number) {
  while (start < end) {
    const temp = array[start];
    array[start] = array[end];
    array[end] = temp;
    start++;
    end--;
  }
}

export function rotateInPlace<T>(array: T[], offset: number): T[] {
  const length = array.length;

  if (array.length <= 1) return array;

  const index = mod(offset, length);
  if (index === 0) return array;

  reverse(array, 0, index - 1);
  reverse(array, index, length - 1);
  reverse(array, 0, length - 1);

  return array;
}

export function rotate<T>(array: T[], offset: number) {
  if (array.length === 0) return array;

  const length = array.length;
  const index = mod(offset, length);

  return [...array.slice(index), ...array.slice(0, index)];
}
