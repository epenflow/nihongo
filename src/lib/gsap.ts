import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Draggable, ScrollTrigger, TextPlugin } from "gsap/all";

gsap.registerPlugin(useGSAP, ScrollTrigger, Draggable, TextPlugin);

export { Draggable, gsap, ScrollTrigger, TextPlugin, useGSAP };
