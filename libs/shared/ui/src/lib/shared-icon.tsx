import { Heart, Search, UserRound, X, type LucideProps } from 'lucide-react';
import styles from './shared-ui.module.css';

const iconByName = {
  close: X,
  heart: Heart,
  search: Search,
  user: UserRound,
} as const;

export type IconName = keyof typeof iconByName;

export function Icon({
  className,
  name,
  size = 16,
  strokeWidth = 1.85,
  ...rest
}: Omit<LucideProps, 'ref'> & {
  name: IconName;
}) {
  const IconComponent = iconByName[name];

  return (
    <IconComponent
      aria-hidden={rest['aria-label'] ? undefined : true}
      className={[styles.icon, className].filter(Boolean).join(' ')}
      size={size}
      strokeWidth={strokeWidth}
      {...rest}
    />
  );
}
