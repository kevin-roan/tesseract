import { FoldersIcon, HouseSimpleIcon, ListChecksIcon, RobotIcon, UserCircleIcon } from 'phosphor-react-native';

import type { FloatingTab } from '@/components/floating-tab-bar';

export const AppTabRoutes: readonly FloatingTab[] = [
  { name: 'index', href: '/', label: 'Home', icon: HouseSimpleIcon },
  { name: 'agents', href: '/agents', label: 'Agents', icon: RobotIcon },
  { name: 'tasks', href: '/tasks', label: 'Tasks', icon: ListChecksIcon },
  { name: 'projects', href: '/projects', label: 'Projects', icon: FoldersIcon },
  { name: 'profile', href: '/profile', label: 'Profile', icon: UserCircleIcon },
];
