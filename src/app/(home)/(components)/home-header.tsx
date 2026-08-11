import { ButtonLink } from "#/components/ui/button";
import { SidebarTrigger } from "#/components/ui/sidebar";

export function HomeHeader() {
  return (
    <header className="border-b bg-card">
      <nav className="p-2">
        <SidebarTrigger />
        <ButtonLink to="/study">Study</ButtonLink>
      </nav>
    </header>
  );
}
