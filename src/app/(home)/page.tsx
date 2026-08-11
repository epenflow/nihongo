import { FlashCardDemo } from "#/components/flashcard/index.ts";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(home)/")({
  component: RouteComponent,
});

function RouteComponent() {
  return <FlashCardDemo.Carousel />;
}
