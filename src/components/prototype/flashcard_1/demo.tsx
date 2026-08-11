import { Card } from "#/components/flashcard/card.tsx";
import { Carousel } from "#/components/flashcard/carousel.tsx";
import { Badge } from "#/components/ui/badge.tsx";
import { cn } from "#/lib/utils.ts";

const cards = Array.from({ length: 100 }, (_, index) => ({
  id: String(index),
  index,
}));

export function Demo() {
  return (
    <Carousel.Root className="max-h-svh" stackXDepth={-16} stackYDepth={10}>
      <Carousel.Indicator />
      <Carousel.Counter />
      <Carousel.Viewport>
        <Carousel.Items items={cards} getKey={(card) => card.id}>
          {(card, { dragging }) => (
            <Card.Root className={cn(dragging && "pointer-events-none")}>
              <Card.Front>
                <Badge className="absolute inset-1">Front</Badge>
                <span>Front Face {card.index}</span>
              </Card.Front>
              <Card.Back>
                <Badge className="absolute inset-1">Back</Badge>
                <span>Back Face {card.index}</span>
              </Card.Back>
            </Card.Root>
          )}
        </Carousel.Items>
      </Carousel.Viewport>
      <Carousel.Next>Next</Carousel.Next>
      <Carousel.Prev>Prev</Carousel.Prev>
    </Carousel.Root>
  );
}
