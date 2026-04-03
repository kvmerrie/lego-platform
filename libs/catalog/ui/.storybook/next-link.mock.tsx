import type { AnchorHTMLAttributes, ReactNode } from 'react';

type StorybookNextLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode;
  href: string;
};

export default function StorybookNextLink({
  children,
  href,
  ...rest
}: StorybookNextLinkProps) {
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}
