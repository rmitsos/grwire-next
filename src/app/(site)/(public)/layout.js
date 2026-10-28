import { PublicFooter } from "@/components/PublicFooter";
import { PublicHeader } from "@/components/PublicHeader";

export default function PublicLayout({ children }) {
  return (
    <div className="public-shell">
      <PublicHeader />
      {children}
      <PublicFooter />
    </div>
  );
}
