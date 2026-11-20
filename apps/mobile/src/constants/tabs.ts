import { FoldersIcon, HouseSimpleIcon, ListChecksIcon, SparkleIcon, UserCircleIcon } from 'phosphor-react-native';

import type { FloatingTab } from '@/components/floating-tab-bar';
import type { NativeTab } from '@/components/native-tab-bar';

export type AppTab = FloatingTab & NativeTab;

export const AppTabRoutes: readonly AppTab[] = [
  { name: 'index', href: '/', label: 'Home', icon: HouseSimpleIcon, symbol: { default: 'house', selected: 'house.fill' } },
  { name: 'agents', href: '/agents', label: 'Agents', icon: SparkleIcon, symbol: { default: 'sparkles', selected: 'sparkles' } },
  { name: 'tasks', href: '/tasks', label: 'Tasks', icon: ListChecksIcon, symbol: { default: 'checklist', selected: 'checklist' } },
  { name: 'projects', href: '/projects', label: 'Projects', icon: FoldersIcon, symbol: { default: 'folder', selected: 'folder.fill' } },
  {
    name: 'profile',
    href: '/profile',
    label: 'Profile',
    icon: UserCircleIcon,
    symbol: { default: 'person.crop.circle', selected: 'person.crop.circle.fill' },
  },
];
