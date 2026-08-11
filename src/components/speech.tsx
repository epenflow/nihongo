import { Button, type ButtonProps } from "#/components/ui/button";
import { mergeProps } from "@base-ui/react";
import {
  useEffect,
  useMemo,
  useSyncExternalStore,
  type MouseEvent,
} from "react";

abstract class Emitter {
  private listeners: Set<VoidFunction> = new Set<VoidFunction>();

  public subscribe = (callback: VoidFunction): VoidFunction => {
    this.listeners.add(callback);

    return () => this.listeners.delete(callback);
  };

  protected notify(): void {
    for (const callback of this.listeners) callback();
  }
}

interface SpeechOptions {
  lang: string;
  rate: number;
}

const DEFEAULT_SPEECH_OPTIONS: SpeechOptions = { rate: 1, lang: "ja-JP" };

class SpeechManager extends Emitter {
  private state: boolean = false;
  private lang: string;
  private rate: number;

  constructor(options: SpeechOptions = DEFEAULT_SPEECH_OPTIONS) {
    super();

    this.lang = options.lang;
    this.rate = options.rate;
  }

  public getSnapshot = (): boolean => this.state;
  public getServerSnapshot = (): boolean => false;

  public stop(): void {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    this.setState(false);
  }

  public toggle(text: string): void {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();

    if (this.state) {
      this.setState(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = this.lang;
    utterance.rate = this.rate;
    utterance.onstart = () => this.setState(true);
    utterance.onend = () => this.setState(false);
    utterance.onerror = () => this.setState(false);

    window.speechSynthesis.speak(utterance);
  }

  private setState(state: boolean): void {
    if (this.state === state) return;

    this.state = state;
    this.notify();
  }
}

interface SpeechButtonProps extends ButtonProps {
  text: string;
  lang?: string;
  rate?: number;
}

export function SpeechButton({
  lang = DEFEAULT_SPEECH_OPTIONS.lang,
  rate = DEFEAULT_SPEECH_OPTIONS.rate,
  text,
  ...props
}: SpeechButtonProps) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const speech = useMemo(() => new SpeechManager({ lang, rate }), []);

  const state = useSyncExternalStore(
    speech.subscribe,
    speech.getSnapshot,
    speech.getServerSnapshot,
  );

  useEffect(() => () => speech.stop(), [speech]);

  const mergedProps = mergeProps(props, {
    onClick(event: MouseEvent<HTMLButtonElement>) {
      event.preventDefault();
      event.stopPropagation();
      speech.toggle(text);
    },
  });

  return <Button data-state={state} {...mergedProps} />;
}

interface RecognitionOptions {
  lang: string;
}

const DEFAULT_RECOGNITION_OPTIONS: RecognitionOptions = { lang: "ja-JP" };

type AnalysisStatus = "correct" | "incorrect" | null;

interface RecognitionSnapshot {
  active: boolean;
  status: AnalysisStatus;
}

const IDLE_SNAPSHOT: RecognitionSnapshot = { active: false, status: null };

class SpeechRecognitionManager extends Emitter {
  private state = false;
  private analysisStatus: AnalysisStatus = null;
  private lang: string;
  private recognition: SpeechRecognition | null = null;
  private targetText = "";
  private onResult?: (transcript: string, isCorrect: boolean) => void;

  private snapshot: RecognitionSnapshot = IDLE_SNAPSHOT;

  constructor(options: RecognitionOptions = DEFAULT_RECOGNITION_OPTIONS) {
    super();

    this.lang = options.lang;

    this.init();
  }

  public getSnapshot = (): RecognitionSnapshot => {
    if (
      this.snapshot.active !== this.state ||
      this.snapshot.status !== this.analysisStatus
    ) {
      this.snapshot = {
        active: this.state,
        status: this.analysisStatus,
      };
    }
    return this.snapshot;
  };

  public getServerSnapshot = (): RecognitionSnapshot => IDLE_SNAPSHOT;

  public stop(): void {
    this.recognition?.abort();
  }

  public toggle(
    text: string,
    onResult?: (transcript: string, isCorrect: boolean) => void,
  ): void {
    this.targetText = text;
    this.onResult = onResult;

    if (!this.recognition) return;

    if (this.state) {
      this.recognition.stop();
      return;
    }

    this.analysisStatus = null;
    try {
      this.recognition.start();
    } catch {
      this.recognition.abort();
      this.recognition.start();
    }
  }

  private init(): void {
    if (typeof window === "undefined") return;
    const SpeechRecognitionAPI =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) return;

    const recognition = new SpeechRecognitionAPI();

    recognition.lang = this.lang;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => this.setState(true, null);

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      const cleanTarget = this.targetText.replace(/\s+/g, "");
      const cleanTranscript = transcript.replace(/\s+/g, "");
      const isCorrect = cleanTranscript === cleanTarget;
      const status: AnalysisStatus = isCorrect ? "correct" : "incorrect";

      this.setState(false, status);
      this.onResult?.(transcript, isCorrect);
    };

    recognition.onerror = () => this.setState(false, this.analysisStatus);
    recognition.onend = () => this.setState(false, this.analysisStatus);

    this.recognition = recognition;
  }

  private setState(state: boolean, status: AnalysisStatus): void {
    if (this.state === state && this.analysisStatus === status) return;
    this.state = state;
    this.analysisStatus = status;
    this.notify();
  }
}

interface SpeechAnalyzerButtonProps extends ButtonProps {
  text: string;
  lang?: string;
  onResult?: (transcript: string, isCorrect: boolean) => void;
}

export function SpeechAnalyzerButton({
  lang = DEFAULT_RECOGNITION_OPTIONS.lang,
  text,
  onResult,
  ...props
}: SpeechAnalyzerButtonProps) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const analyzer = useMemo(() => new SpeechRecognitionManager({ lang }), []);

  const snapshot = useSyncExternalStore(
    analyzer.subscribe,
    analyzer.getSnapshot,
    analyzer.getServerSnapshot,
  );

  useEffect(() => () => analyzer.stop(), [analyzer]);

  const mergedProps = mergeProps(props, {
    onClick(event: MouseEvent<HTMLButtonElement>) {
      event.preventDefault();
      event.stopPropagation();
      analyzer.toggle(text, onResult);
    },
  });

  return (
    <Button
      data-state={snapshot.active}
      data-analyzing={
        snapshot.active ? "active" : (snapshot.status ?? "undefined")
      }
      {...mergedProps}
    />
  );
}
