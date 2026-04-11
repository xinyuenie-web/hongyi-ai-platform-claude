/**
 * Base interfaces for AI model adapters (inT layer).
 * Every vision/understanding AI model implements ModelAdapter.
 */

export interface TreeInfo {
  treeId: string;
  name: string;
  species: string;
  coverImage: string;
  heightCm: number;
  crownCm: number;
}

/** Standardized input for all vision model adapters */
export interface VisionInput {
  gardenPhotoBase64: string;   // compressed base64 data URI
  trees: TreeInfo[];
  styleName: string;
  userMessage: string;
}

/** Standardized output from all vision model adapters */
export interface VisionOutput {
  designSummary: string;
  spaceAnalysis: string;
  treePlacement: Array<{
    treeName: string;
    position: string;
    reason: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  styleAdvice: string;
  fengshuiTip: string;
  budgetEstimate: string;
  groundTreatment?: {
    type: string;
    prompt: string;
    groundRegion: { yStart: number; yEnd: number };
  };
}

/** Interface every AI model adapter must implement */
export interface ModelAdapter {
  readonly id: string;
  readonly displayName: string;
  readonly requiresProxy: boolean;
  readonly estimatedLatencyMs: number;

  /** Check if this adapter is configured and reachable */
  healthCheck(): Promise<boolean>;

  /** Run vision analysis — returns standardized output */
  analyze(input: VisionInput): Promise<VisionOutput>;
}
