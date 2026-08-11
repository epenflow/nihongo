export type Overwrite<
  T,
  V extends {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [K in keyof T]?: any;
  },
> = Omit<T, keyof V> & V;

export type PartialKeys<T, K extends keyof T> = Omit<T, K> &
  Partial<Pick<T, K>>;

export type RequiredKeys<T, K extends keyof T> = Omit<T, K> &
  Required<Pick<T, K>>;
