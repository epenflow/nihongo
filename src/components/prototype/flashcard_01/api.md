# FlashCard & Carousel Compound Component API
This document outlines the API design for the `FlashCard` and `FlashCardCarousel` compound components.
## 1. Component Blueprint
This is the structural DOM tree showing how components nest.
```jsx
<FlashCardCarousel.Root>
  <FlashCardCarousel.Viewport>
    
    <FlashCardCarousel.Item>
      <FlashCard.Root>
        
        <FlashCard.Front>
          {/* Front Content */}
        </FlashCard.Front>
        <FlashCard.Back>
          {/* Back Content */}
        </FlashCard.Back>
      </FlashCard.Root>
    </FlashCardCarousel.Item>
    
    {/* Additional Items... */}
  </FlashCardCarousel.Viewport>
  <FlashCardCarousel.Prev>
    Prev
  </FlashCardCarousel.Prev>
  <FlashCardCarousel.Next>
    Next
  </FlashCardCarousel.Next>
</FlashCardCarousel.Root>
```
---
## 2. Dataset API Specification
### FlashCardCarousel Attributes

| Component | Attribute | Values | Description |
| :--- | :--- | :--- | :--- |
| **`.Root`** | `data-start` | `"true" \ | "false"` | `true` when viewing the first item. |
|  | `data-end` | `"true" \ | "false"` | `true` when viewing the last item. |
|  | `data-current` | `number` | Index string of the currently focused item. |
|  | `data-prev` | `number` | Target index for backward navigation (`-1` if at boundaries). |
|  | `data-next` | `number` | Target index for forward navigation (`-1` if at boundaries). |
|  | `data-total` | `number` | Total number of registered items. |
| **`.Viewport`** | `data-dragging` | `"true" \ | "false"` | `true` while the pointer drag gesture is active. |
|  | `data-direction` | `"next" \ | "prev"` | The current or last navigation direction vector. |
| **`.Item`** | `data-index` | `number` | Item's positional index in the list. |
|  | `data-active` | `"true" \ | "false"` | `true` if the item is currently active in the viewport. |
| **`.Prev`** | `data-disabled` | `"true" \ | "false"` | Button disabled state based on start boundaries. |
|  | `data-prev` | `number` | Target index for the previous action. |
| **`.Next`** | `data-disabled` | `"true" \ | "false"` | Button disabled state based on end boundaries. |
|  | `data-next` | `number` | Target index for the next action. |

### FlashCard Attributes

| Component | Attribute | Values | Description |
| :--- | :--- | :--- | :--- |
| **`.Root`** | `data-state` | `"front" \ | "back"` | Represents which side is currently facing forward. |
|  | `data-flipped` | `"true" \ | "false"` | Boolean string flag for rotation status. |
|  | `data-animating` | `"true" \ | "false"` | `true` during active flip transitions (useful for blocking click spam). |
| **`.Front` / `.Back`** | `data-state` | `"front" \ | "back"` | Inherits root card state to simplify backface styling. |

---
## 3. Tailwind CSS Implementation Examples
### Example A: Standalone FlashCard (No Carousel)
Use this when you only need a simple, flippable card without swipe or list mechanics.
```jsx
import { FlashCard } from "./components/FlashCard";
export default function SingleCardExample() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-8">
      <FlashCard.Root className="group relative h-72 w-full max-w-sm cursor-pointer perspective-1000">
        
        <FlashCard.Front className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border-2 border-gray-100 bg-white shadow-lg backface-hidden transition-all duration-300
                     data-[state=back]:pointer-events-none group-hover:border-blue-400 group-hover:shadow-xl">
          <span className="mb-2 text-lg font-medium text-gray-500">ふくざつ</span>
          <h2 className="text-6xl font-extrabold text-gray-800">複雑</h2>
        </FlashCard.Front>
        <FlashCard.Back className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 text-blue-900 shadow-lg backface-hidden rotate-y-180 
                     data-[state=front]:pointer-events-none">
          <h3 className="text-3xl font-bold">Complex</h3>
          <p className="mt-2 text-blue-700">Complicated; Intricate</p>
        </FlashCard.Back>
      </FlashCard.Root>
    </div>
  );
}
```
### Example B: Study Deck with FlashCardCarousel
Wraps multiple `FlashCard` components into a swipeable, paginated study deck.
```jsx
import { FlashCard, FlashCardCarousel } from "./components/FlashCard";
const deckData = [
  { id: "1", kanji: "環境", furigana: "かんきょう", meaning: "Environment" },
  { id: "2", kanji: "準備", furigana: "じゅんび", meaning: "Preparation" },
  { id: "3", kanji: "経験", furigana: "けいけん", meaning: "Experience" }
];
export default function CarouselDeckExample() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center p-6">
      
      <FlashCardCarousel.Root>
        <div className="mb-4 flex w-full justify-between px-4 text-sm font-medium text-gray-400">
          <span>Study Deck</span>
          <span>Swipe to review</span> 
        </div>
        <FlashCardCarousel.Viewport className="flex w-full overflow-hidden py-4
                     data-[dragging=true]:cursor-grabbing data-[dragging=false]:cursor-grab active:scale-[0.98] transition-transform" draggable="{true}">
          {deckData.map((card) => (
            <FlashCardCarousel.Item className="min-w-full px-4" key="{card.id}">
              
              <FlashCard.Root className="group relative h-80 w-full perspective-1000">
                <FlashCard.Front className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border-2 border-gray-100 bg-white shadow-xl backface-hidden data-[state=back]:pointer-events-none">
                  <span className="mb-3 text-xl font-medium text-gray-500">{card.furigana}</span>
                  <h2 className="text-7xl font-bold text-gray-800">{card.kanji}</h2>
                </FlashCard.Front>
                <FlashCard.Back className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-emerald-50 text-emerald-900 shadow-xl backface-hidden rotate-y-180 data-[state=front]:pointer-events-none">
                  <h3 className="text-4xl font-bold">{card.meaning}</h3>
                </FlashCard.Back>
              </FlashCard.Root>
            </FlashCardCarousel.Item>
          ))}
        </FlashCardCarousel.Viewport>
        <div className="mt-8 flex w-full justify-center gap-6">
          <FlashCardCarousel.Prev className="flex h-12 w-24 items-center justify-center rounded-full bg-white font-semibold text-gray-700 shadow-md transition-all 
                       data-[disabled=true]:opacity-30 data-[disabled=true]:cursor-not-allowed
                       data-[disabled=false]:hover:bg-gray-50 data-[disabled=false]:hover:shadow-lg data-[disabled=false]:active:scale-95">
            &larr; Prev
          </FlashCardCarousel.Prev>
          
          <FlashCardCarousel.Next className="flex h-12 w-24 items-center justify-center rounded-full bg-blue-600 font-semibold text-white shadow-md transition-all 
                       data-[disabled=true]:opacity-30 data-[disabled=true]:cursor-not-allowed
                       data-[disabled=false]:hover:bg-blue-700 data-[disabled=false]:hover:shadow-lg data-[disabled=false]:active:scale-95">
            Next &rarr;
          </FlashCardCarousel.Next>
        </div>
      </FlashCardCarousel.Root>
      
    </div>
  );
}
```