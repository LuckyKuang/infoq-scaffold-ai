import IFrame from '@/components/iFrame';

type InnerLinkProps = {
  src: string;
  iframeId?: string;
};

export default function InnerLink({ src, iframeId }: InnerLinkProps) {
  return <IFrame src={src} iframeId={iframeId} />;
}
