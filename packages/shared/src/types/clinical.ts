export enum Modality {
  CT = 'CT',
  MRI = 'MRI',
  XRAY = 'XRAY',
  ULTRASOUND = 'US',
  PET = 'PET',
  PET_CT = 'PET_CT',
  NUCLEAR_MEDICINE = 'NM',
  MAMMOGRAPHY = 'MG',
  FLUOROSCOPY = 'FL',
  INTERVENTIONAL = 'IR',
  DEXA = 'DEXA',
  ANGIOGRAPHY = 'ANGIO',
}

export enum BodyPart {
  HEAD = 'HEAD',
  BRAIN = 'BRAIN',
  NECK = 'NECK',
  CERVICAL_SPINE = 'CERVICAL_SPINE',
  THORACIC_SPINE = 'THORACIC_SPINE',
  LUMBAR_SPINE = 'LUMBAR_SPINE',
  CHEST = 'CHEST',
  ABDOMEN = 'ABDOMEN',
  PELVIS = 'PELVIS',
  ABDOMEN_PELVIS = 'ABDOMEN_PELVIS',
  SHOULDER = 'SHOULDER',
  UPPER_ARM = 'UPPER_ARM',
  ELBOW = 'ELBOW',
  FOREARM = 'FOREARM',
  WRIST = 'WRIST',
  HAND = 'HAND',
  HIP = 'HIP',
  UPPER_LEG = 'UPPER_LEG',
  KNEE = 'KNEE',
  LOWER_LEG = 'LOWER_LEG',
  ANKLE = 'ANKLE',
  FOOT = 'FOOT',
  WHOLE_BODY = 'WHOLE_BODY',
  BREAST = 'BREAST',
  HEART = 'HEART',
  ORBIT = 'ORBIT',
  SINUSES = 'SINUSES',
  TEMPORAL_BONES = 'TEMPORAL_BONES',
  FACE = 'FACE',
  MANDIBLE = 'MANDIBLE',
  SACRUM = 'SACRUM',
  COCCYX = 'COCCYX',
  RIBS = 'RIBS',
  STERNUM = 'STERNUM',
  CLAVICLE = 'CLAVICLE',
  SCAPULA = 'SCAPULA',
  THYROID = 'THYROID',
  LIVER = 'LIVER',
  KIDNEY = 'KIDNEY',
  PANCREAS = 'PANCREAS',
  SPLEEN = 'SPLEEN',
  GALLBLADDER = 'GALLBLADDER',
  BLADDER = 'BLADDER',
  PROSTATE = 'PROSTATE',
  UTERUS = 'UTERUS',
  OVARY = 'OVARY',
  TESTICLE = 'TESTICLE',
  AORTA = 'AORTA',
  CAROTID = 'CAROTID',
  EXTREMITY_VEINS = 'EXTREMITY_VEINS',
  EXTREMITY_ARTERIES = 'EXTREMITY_ARTERIES',
}

export enum Laterality {
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
  BILATERAL = 'BILATERAL',
  NA = 'N/A',
}

export enum Priority {
  STAT = 'STAT',
  URGENT = 'URGENT',
  ASAP = 'ASAP',
  ROUTINE = 'ROUTINE',
}

export enum ContrastType {
  NONE = 'NONE',
  IV = 'IV',
  ORAL = 'ORAL',
  IV_AND_ORAL = 'IV_AND_ORAL',
  RECTAL = 'RECTAL',
  INTRATHECAL = 'INTRATHECAL',
  INTRA_ARTICULAR = 'INTRA_ARTICULAR',
  GADOLINIUM = 'GADOLINIUM',
}

export interface CPTCodeEntry {
  code: string;
  description: string;
  modality: Modality;
  bodyPart?: BodyPart;
  contrast?: boolean;
  professionalComponent?: string;
  technicalComponent?: string;
  rvu?: number;
}

export interface ICD10CodeEntry {
  code: string;
  description: string;
  category: string;
  isRadiologyRelevant: boolean;
}

export interface ClinicalIndication {
  primaryDiagnosis: string;
  icd10Code: string;
  clinicalHistory?: string;
  relevantSymptoms?: string[];
  relevantLabValues?: LabValue[];
  previousImagingDates?: string[];
  previousImagingFindings?: string;
}

export interface LabValue {
  name: string;
  value: number;
  unit: string;
  referenceRange?: string;
  collectedAt?: string;
  abnormalFlag?: 'HIGH' | 'LOW' | 'CRITICAL_HIGH' | 'CRITICAL_LOW' | 'NORMAL';
}

export interface ProtocolRecommendation {
  protocolName: string;
  modality: Modality;
  bodyPart: BodyPart;
  contrast: ContrastType;
  sequences?: string[];
  sliceThickness?: number;
  fieldOfView?: string;
  specialInstructions?: string;
  estimatedDurationMinutes: number;
  radiationDose?: string;
}

export interface ModalityDetails {
  code: Modality;
  displayName: string;
  dicomModality: string;
  requiresContrast: boolean;
  requiresPrep: boolean;
  requiresScreening: boolean;
  averageDurationMinutes: number;
  defaultProtocol?: string;
}

export const MODALITY_DETAILS: Record<Modality, ModalityDetails> = {
  [Modality.CT]: {
    code: Modality.CT,
    displayName: 'Computed Tomography',
    dicomModality: 'CT',
    requiresContrast: false,
    requiresPrep: false,
    requiresScreening: true,
    averageDurationMinutes: 15,
  },
  [Modality.MRI]: {
    code: Modality.MRI,
    displayName: 'Magnetic Resonance Imaging',
    dicomModality: 'MR',
    requiresContrast: false,
    requiresPrep: false,
    requiresScreening: true,
    averageDurationMinutes: 45,
  },
  [Modality.XRAY]: {
    code: Modality.XRAY,
    displayName: 'X-Ray',
    dicomModality: 'CR',
    requiresContrast: false,
    requiresPrep: false,
    requiresScreening: false,
    averageDurationMinutes: 10,
  },
  [Modality.ULTRASOUND]: {
    code: Modality.ULTRASOUND,
    displayName: 'Ultrasound',
    dicomModality: 'US',
    requiresContrast: false,
    requiresPrep: true,
    requiresScreening: false,
    averageDurationMinutes: 30,
  },
  [Modality.PET]: {
    code: Modality.PET,
    displayName: 'Positron Emission Tomography',
    dicomModality: 'PT',
    requiresContrast: false,
    requiresPrep: true,
    requiresScreening: true,
    averageDurationMinutes: 120,
  },
  [Modality.PET_CT]: {
    code: Modality.PET_CT,
    displayName: 'PET/CT',
    dicomModality: 'PT',
    requiresContrast: false,
    requiresPrep: true,
    requiresScreening: true,
    averageDurationMinutes: 150,
  },
  [Modality.NUCLEAR_MEDICINE]: {
    code: Modality.NUCLEAR_MEDICINE,
    displayName: 'Nuclear Medicine',
    dicomModality: 'NM',
    requiresContrast: false,
    requiresPrep: true,
    requiresScreening: true,
    averageDurationMinutes: 60,
  },
  [Modality.MAMMOGRAPHY]: {
    code: Modality.MAMMOGRAPHY,
    displayName: 'Mammography',
    dicomModality: 'MG',
    requiresContrast: false,
    requiresPrep: false,
    requiresScreening: false,
    averageDurationMinutes: 20,
  },
  [Modality.FLUOROSCOPY]: {
    code: Modality.FLUOROSCOPY,
    displayName: 'Fluoroscopy',
    dicomModality: 'RF',
    requiresContrast: true,
    requiresPrep: true,
    requiresScreening: true,
    averageDurationMinutes: 30,
  },
  [Modality.INTERVENTIONAL]: {
    code: Modality.INTERVENTIONAL,
    displayName: 'Interventional Radiology',
    dicomModality: 'XA',
    requiresContrast: true,
    requiresPrep: true,
    requiresScreening: true,
    averageDurationMinutes: 90,
  },
  [Modality.DEXA]: {
    code: Modality.DEXA,
    displayName: 'Bone Densitometry (DEXA)',
    dicomModality: 'DX',
    requiresContrast: false,
    requiresPrep: false,
    requiresScreening: false,
    averageDurationMinutes: 15,
  },
  [Modality.ANGIOGRAPHY]: {
    code: Modality.ANGIOGRAPHY,
    displayName: 'Angiography',
    dicomModality: 'XA',
    requiresContrast: true,
    requiresPrep: true,
    requiresScreening: true,
    averageDurationMinutes: 60,
  },
};
