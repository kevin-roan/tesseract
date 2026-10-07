export interface ListGroupData<T> {
  key: string;
  title: string;
  items: readonly T[];
}
