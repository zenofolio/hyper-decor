import { HyperCommonMetadata, HyperMethodMetadata } from "../types";
import { Metadata } from "./meta.store";

export const HyperMeta = Metadata.prefix<HyperCommonMetadata, HyperMethodMetadata>('server');
