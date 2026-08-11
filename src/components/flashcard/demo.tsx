import { Card } from "#/components/flashcard/card.tsx";
import { Carousel } from "#/components/flashcard/carousel.tsx";
import { Furigana } from "#/components/furigana/index.ts";
import { Badge } from "#/components/ui/badge.tsx";
import { cn } from "#/lib/utils.ts";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import vocabularies from "./data.json";

function FlashCardDemo() {
  return (
    <Card.Root
      render={(props) => (
        <Card.Tilt>
          <div {...props} />
        </Card.Tilt>
      )}
      className={cn(
        "[&_.face]:flex [&_.face]:items-center [&_.face]:justify-center",
        "[&_.badge]:absolute [&_.badge]:inset-1",
      )}>
      <Card.Front className="face">
        <Badge className="badge">Front</Badge>
        <span>Front Face</span>
      </Card.Front>
      <Card.Back className="face">
        <Badge className="badge">Back</Badge>
        <span>Back Face</span>
      </Card.Back>
    </Card.Root>
  );
}

function FlashCardCarouselDemo() {
  return (
    <Carousel.Root className="h-full flex flex-col">
      <Carousel.Viewport className="flex-1">
        {vocabularies.slice(0, 10).map((vocabulary, index) => (
          <Carousel.Item key={vocabulary.id} data-index={index}>
            {({ dragging, dismissed, firstIndex }) => (
              <Card.Root
                data-dragging={dragging}
                className={cn(
                  "[&_.face]:flex [&_.face]:items-center [&_.face]:justify-center [&_.face]:p-4",
                  "[&_.badge]:absolute [&_.badge]:inset-1",
                  "w-xs sm:w-sm shadow-xl",
                  {
                    "bg-destructive transition-colors text-primary-foreground":
                      dismissed,
                    "pointer-events-none": !firstIndex,
                  },
                )}>
                <Card.Front className={cn("face flex-col justify-between!")}>
                  <Badge className="badge">
                    {dismissed ? "Release to Skip" : "Question"}
                  </Badge>
                  <Furigana className="text-3xl my-auto">
                    {vocabulary.vocabulary}
                  </Furigana>
                  <ul className="space-y-0.5">
                    <li>Example</li>
                    {vocabulary.example.map((exampe, index) => (
                      <li key={index}>
                        <Furigana className="text-sm">{exampe}</Furigana>
                      </li>
                    ))}
                  </ul>
                </Card.Front>
                <Card.Back className="face">
                  <Badge className="badge">
                    {dismissed ? "Release to Skip" : "Answer"}
                  </Badge>
                  <p className="text-2xl">{vocabulary.meaning}</p>
                </Card.Back>
              </Card.Root>
            )}
          </Carousel.Item>
        ))}
      </Carousel.Viewport>
      <div className="inline-flex items-center justify-center gap-2">
        <Carousel.Prev>
          <ArrowLeftIcon />
        </Carousel.Prev>
        <Carousel.Next>
          <ArrowRightIcon />
        </Carousel.Next>
      </div>
    </Carousel.Root>
  );
}

export const Demo = {
  Card: FlashCardDemo,
  Carousel: FlashCardCarouselDemo,
};
