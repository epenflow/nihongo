import { HomeHeader } from "#/app/(home)/(components)/home-header";
import { HomeSidebar } from "#/app/(home)/(components)/home-sidebar";
import { SidebarInset, SidebarProvider } from "#/components/ui/sidebar";
import { TooltipProvider } from "#/components/ui/tooltip";
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/(home)")({
  component: Outlet,
});

function RouteComponent() {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <HomeSidebar />
        <SidebarInset>
          <HomeHeader />
          <Outlet />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
