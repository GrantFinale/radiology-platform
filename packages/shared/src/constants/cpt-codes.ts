import { BodyPart, CPTCodeEntry, Modality } from '../types/clinical';

/**
 * Common radiology CPT codes organized by modality.
 */
export const RADIOLOGY_CPT_CODES: CPTCodeEntry[] = [
  // =============================================================
  // CT (Computed Tomography)
  // =============================================================
  { code: '70450', description: 'CT head/brain without contrast', modality: Modality.CT, bodyPart: BodyPart.HEAD, contrast: false },
  { code: '70460', description: 'CT head/brain with contrast', modality: Modality.CT, bodyPart: BodyPart.HEAD, contrast: true },
  { code: '70470', description: 'CT head/brain without contrast, followed by contrast', modality: Modality.CT, bodyPart: BodyPart.HEAD, contrast: true },
  { code: '70486', description: 'CT maxillofacial without contrast', modality: Modality.CT, bodyPart: BodyPart.FACE, contrast: false },
  { code: '70490', description: 'CT soft tissue neck without contrast', modality: Modality.CT, bodyPart: BodyPart.NECK, contrast: false },
  { code: '70491', description: 'CT soft tissue neck with contrast', modality: Modality.CT, bodyPart: BodyPart.NECK, contrast: true },
  { code: '71250', description: 'CT chest without contrast', modality: Modality.CT, bodyPart: BodyPart.CHEST, contrast: false },
  { code: '71260', description: 'CT chest with contrast', modality: Modality.CT, bodyPart: BodyPart.CHEST, contrast: true },
  { code: '71270', description: 'CT chest without contrast, followed by contrast', modality: Modality.CT, bodyPart: BodyPart.CHEST, contrast: true },
  { code: '71275', description: 'CT angiography chest', modality: Modality.CT, bodyPart: BodyPart.CHEST, contrast: true },
  { code: '74150', description: 'CT abdomen without contrast', modality: Modality.CT, bodyPart: BodyPart.ABDOMEN, contrast: false },
  { code: '74160', description: 'CT abdomen with contrast', modality: Modality.CT, bodyPart: BodyPart.ABDOMEN, contrast: true },
  { code: '74170', description: 'CT abdomen without contrast, followed by contrast', modality: Modality.CT, bodyPart: BodyPart.ABDOMEN, contrast: true },
  { code: '74176', description: 'CT abdomen and pelvis without contrast', modality: Modality.CT, bodyPart: BodyPart.ABDOMEN_PELVIS, contrast: false },
  { code: '74177', description: 'CT abdomen and pelvis with contrast', modality: Modality.CT, bodyPart: BodyPart.ABDOMEN_PELVIS, contrast: true },
  { code: '74178', description: 'CT abdomen and pelvis without contrast, followed by contrast', modality: Modality.CT, bodyPart: BodyPart.ABDOMEN_PELVIS, contrast: true },
  { code: '72125', description: 'CT cervical spine without contrast', modality: Modality.CT, bodyPart: BodyPart.CERVICAL_SPINE, contrast: false },
  { code: '72128', description: 'CT thoracic spine without contrast', modality: Modality.CT, bodyPart: BodyPart.THORACIC_SPINE, contrast: false },
  { code: '72131', description: 'CT lumbar spine without contrast', modality: Modality.CT, bodyPart: BodyPart.LUMBAR_SPINE, contrast: false },

  // =============================================================
  // MRI (Magnetic Resonance Imaging)
  // =============================================================
  { code: '70551', description: 'MRI brain without contrast', modality: Modality.MRI, bodyPart: BodyPart.BRAIN, contrast: false },
  { code: '70552', description: 'MRI brain with contrast', modality: Modality.MRI, bodyPart: BodyPart.BRAIN, contrast: true },
  { code: '70553', description: 'MRI brain without contrast, followed by contrast', modality: Modality.MRI, bodyPart: BodyPart.BRAIN, contrast: true },
  { code: '70540', description: 'MRI orbit/face/neck without contrast', modality: Modality.MRI, bodyPart: BodyPart.ORBIT, contrast: false },
  { code: '72141', description: 'MRI cervical spine without contrast', modality: Modality.MRI, bodyPart: BodyPart.CERVICAL_SPINE, contrast: false },
  { code: '72146', description: 'MRI thoracic spine without contrast', modality: Modality.MRI, bodyPart: BodyPart.THORACIC_SPINE, contrast: false },
  { code: '72148', description: 'MRI lumbar spine without contrast', modality: Modality.MRI, bodyPart: BodyPart.LUMBAR_SPINE, contrast: false },
  { code: '72149', description: 'MRI lumbar spine with contrast', modality: Modality.MRI, bodyPart: BodyPart.LUMBAR_SPINE, contrast: true },
  { code: '71550', description: 'MRI chest without contrast', modality: Modality.MRI, bodyPart: BodyPart.CHEST, contrast: false },
  { code: '74181', description: 'MRI abdomen without contrast', modality: Modality.MRI, bodyPart: BodyPart.ABDOMEN, contrast: false },
  { code: '74183', description: 'MRI abdomen without contrast, followed by contrast', modality: Modality.MRI, bodyPart: BodyPart.ABDOMEN, contrast: true },
  { code: '73221', description: 'MRI upper extremity joint without contrast', modality: Modality.MRI, bodyPart: BodyPart.SHOULDER, contrast: false },
  { code: '73721', description: 'MRI lower extremity joint without contrast (knee)', modality: Modality.MRI, bodyPart: BodyPart.KNEE, contrast: false },
  { code: '73718', description: 'MRI lower extremity (non-joint) without contrast', modality: Modality.MRI, bodyPart: BodyPart.LOWER_LEG, contrast: false },

  // =============================================================
  // X-Ray
  // =============================================================
  { code: '71045', description: 'X-ray chest single view', modality: Modality.XRAY, bodyPart: BodyPart.CHEST, contrast: false },
  { code: '71046', description: 'X-ray chest 2 views', modality: Modality.XRAY, bodyPart: BodyPart.CHEST, contrast: false },
  { code: '72040', description: 'X-ray cervical spine 2-3 views', modality: Modality.XRAY, bodyPart: BodyPart.CERVICAL_SPINE, contrast: false },
  { code: '72070', description: 'X-ray thoracic spine 2 views', modality: Modality.XRAY, bodyPart: BodyPart.THORACIC_SPINE, contrast: false },
  { code: '72100', description: 'X-ray lumbar spine 2-3 views', modality: Modality.XRAY, bodyPart: BodyPart.LUMBAR_SPINE, contrast: false },
  { code: '72110', description: 'X-ray lumbar spine complete (minimum 4 views)', modality: Modality.XRAY, bodyPart: BodyPart.LUMBAR_SPINE, contrast: false },
  { code: '73030', description: 'X-ray shoulder complete (minimum 2 views)', modality: Modality.XRAY, bodyPart: BodyPart.SHOULDER, contrast: false },
  { code: '73060', description: 'X-ray humerus minimum 2 views', modality: Modality.XRAY, bodyPart: BodyPart.UPPER_ARM, contrast: false },
  { code: '73070', description: 'X-ray elbow 2 views', modality: Modality.XRAY, bodyPart: BodyPart.ELBOW, contrast: false },
  { code: '73110', description: 'X-ray wrist complete (minimum 3 views)', modality: Modality.XRAY, bodyPart: BodyPart.WRIST, contrast: false },
  { code: '73130', description: 'X-ray hand minimum 3 views', modality: Modality.XRAY, bodyPart: BodyPart.HAND, contrast: false },
  { code: '73502', description: 'X-ray hip 2-3 views', modality: Modality.XRAY, bodyPart: BodyPart.HIP, contrast: false },
  { code: '73560', description: 'X-ray knee 1-2 views', modality: Modality.XRAY, bodyPart: BodyPart.KNEE, contrast: false },
  { code: '73562', description: 'X-ray knee 3 views', modality: Modality.XRAY, bodyPart: BodyPart.KNEE, contrast: false },
  { code: '73590', description: 'X-ray tibia/fibula 2 views', modality: Modality.XRAY, bodyPart: BodyPart.LOWER_LEG, contrast: false },
  { code: '73610', description: 'X-ray ankle complete (minimum 3 views)', modality: Modality.XRAY, bodyPart: BodyPart.ANKLE, contrast: false },
  { code: '73630', description: 'X-ray foot complete (minimum 3 views)', modality: Modality.XRAY, bodyPart: BodyPart.FOOT, contrast: false },
  { code: '74018', description: 'X-ray abdomen 1 view', modality: Modality.XRAY, bodyPart: BodyPart.ABDOMEN, contrast: false },
  { code: '74019', description: 'X-ray abdomen 2 views', modality: Modality.XRAY, bodyPart: BodyPart.ABDOMEN, contrast: false },
  { code: '72202', description: 'X-ray sacroiliac joints 3 or more views', modality: Modality.XRAY, bodyPart: BodyPart.SACRUM, contrast: false },

  // =============================================================
  // Ultrasound
  // =============================================================
  { code: '76536', description: 'US soft tissues of head and neck', modality: Modality.ULTRASOUND, bodyPart: BodyPart.NECK, contrast: false },
  { code: '76604', description: 'US chest (includes mediastinum)', modality: Modality.ULTRASOUND, bodyPart: BodyPart.CHEST, contrast: false },
  { code: '76700', description: 'US abdomen complete', modality: Modality.ULTRASOUND, bodyPart: BodyPart.ABDOMEN, contrast: false },
  { code: '76705', description: 'US abdomen limited', modality: Modality.ULTRASOUND, bodyPart: BodyPart.ABDOMEN, contrast: false },
  { code: '76770', description: 'US retroperitoneal complete', modality: Modality.ULTRASOUND, bodyPart: BodyPart.KIDNEY, contrast: false },
  { code: '76775', description: 'US retroperitoneal limited', modality: Modality.ULTRASOUND, bodyPart: BodyPart.KIDNEY, contrast: false },
  { code: '76856', description: 'US pelvic complete', modality: Modality.ULTRASOUND, bodyPart: BodyPart.PELVIS, contrast: false },
  { code: '76857', description: 'US pelvic limited', modality: Modality.ULTRASOUND, bodyPart: BodyPart.PELVIS, contrast: false },
  { code: '76830', description: 'US transvaginal', modality: Modality.ULTRASOUND, bodyPart: BodyPart.UTERUS, contrast: false },
  { code: '76870', description: 'US scrotum and contents', modality: Modality.ULTRASOUND, bodyPart: BodyPart.TESTICLE, contrast: false },
  { code: '93880', description: 'US duplex scan extracranial arteries (carotid)', modality: Modality.ULTRASOUND, bodyPart: BodyPart.CAROTID, contrast: false },
  { code: '93970', description: 'US duplex scan extremity veins complete bilateral', modality: Modality.ULTRASOUND, bodyPart: BodyPart.EXTREMITY_VEINS, contrast: false },
  { code: '93971', description: 'US duplex scan extremity veins unilateral', modality: Modality.ULTRASOUND, bodyPart: BodyPart.EXTREMITY_VEINS, contrast: false },
  { code: '76641', description: 'US breast complete', modality: Modality.ULTRASOUND, bodyPart: BodyPart.BREAST, contrast: false },
  { code: '76642', description: 'US breast limited', modality: Modality.ULTRASOUND, bodyPart: BodyPart.BREAST, contrast: false },

  // =============================================================
  // Mammography
  // =============================================================
  { code: '77065', description: 'Diagnostic mammography unilateral', modality: Modality.MAMMOGRAPHY, bodyPart: BodyPart.BREAST, contrast: false },
  { code: '77066', description: 'Diagnostic mammography bilateral', modality: Modality.MAMMOGRAPHY, bodyPart: BodyPart.BREAST, contrast: false },
  { code: '77067', description: 'Screening mammography bilateral', modality: Modality.MAMMOGRAPHY, bodyPart: BodyPart.BREAST, contrast: false },

  // =============================================================
  // Nuclear Medicine
  // =============================================================
  { code: '78300', description: 'Bone imaging limited area', modality: Modality.NUCLEAR_MEDICINE, bodyPart: BodyPart.WHOLE_BODY, contrast: false },
  { code: '78305', description: 'Bone imaging multiple areas', modality: Modality.NUCLEAR_MEDICINE, bodyPart: BodyPart.WHOLE_BODY, contrast: false },
  { code: '78306', description: 'Bone imaging whole body', modality: Modality.NUCLEAR_MEDICINE, bodyPart: BodyPart.WHOLE_BODY, contrast: false },
  { code: '78452', description: 'Myocardial perfusion imaging SPECT', modality: Modality.NUCLEAR_MEDICINE, bodyPart: BodyPart.HEART, contrast: false },
  { code: '78014', description: 'Thyroid imaging with uptake', modality: Modality.NUCLEAR_MEDICINE, bodyPart: BodyPart.THYROID, contrast: false },
  { code: '78226', description: 'Hepatobiliary system imaging (HIDA scan)', modality: Modality.NUCLEAR_MEDICINE, bodyPart: BodyPart.GALLBLADDER, contrast: false },
  { code: '78707', description: 'Kidney imaging with vascular flow and function', modality: Modality.NUCLEAR_MEDICINE, bodyPart: BodyPart.KIDNEY, contrast: false },

  // =============================================================
  // PET/PET-CT
  // =============================================================
  { code: '78811', description: 'PET imaging limited area', modality: Modality.PET, contrast: false },
  { code: '78812', description: 'PET imaging skull base to mid-thigh', modality: Modality.PET, contrast: false },
  { code: '78813', description: 'PET imaging whole body', modality: Modality.PET, bodyPart: BodyPart.WHOLE_BODY, contrast: false },
  { code: '78814', description: 'PET with CT limited area', modality: Modality.PET_CT, contrast: false },
  { code: '78815', description: 'PET with CT skull base to mid-thigh', modality: Modality.PET_CT, contrast: false },
  { code: '78816', description: 'PET with CT whole body', modality: Modality.PET_CT, bodyPart: BodyPart.WHOLE_BODY, contrast: false },

  // =============================================================
  // Fluoroscopy
  // =============================================================
  { code: '74220', description: 'Esophagram (barium swallow)', modality: Modality.FLUOROSCOPY, contrast: true },
  { code: '74246', description: 'Upper GI series with small bowel follow-through', modality: Modality.FLUOROSCOPY, bodyPart: BodyPart.ABDOMEN, contrast: true },
  { code: '74270', description: 'Barium enema', modality: Modality.FLUOROSCOPY, bodyPart: BodyPart.ABDOMEN, contrast: true },
  { code: '77084', description: 'MRI bone marrow imaging', modality: Modality.MRI, bodyPart: BodyPart.WHOLE_BODY, contrast: false },

  // =============================================================
  // DEXA (Bone Densitometry)
  // =============================================================
  { code: '77080', description: 'DEXA bone density axial (spine/hip)', modality: Modality.DEXA, bodyPart: BodyPart.LUMBAR_SPINE, contrast: false },
  { code: '77081', description: 'DEXA bone density appendicular (forearm)', modality: Modality.DEXA, bodyPart: BodyPart.FOREARM, contrast: false },
];

/**
 * Look up a CPT code entry by code.
 */
export function getCPTCodeEntry(code: string): CPTCodeEntry | undefined {
  return RADIOLOGY_CPT_CODES.find((entry) => entry.code === code);
}

/**
 * Get all CPT codes for a given modality.
 */
export function getCPTCodesByModality(modality: Modality): CPTCodeEntry[] {
  return RADIOLOGY_CPT_CODES.filter((entry) => entry.modality === modality);
}

/**
 * Get all CPT codes for a given body part.
 */
export function getCPTCodesByBodyPart(bodyPart: BodyPart): CPTCodeEntry[] {
  return RADIOLOGY_CPT_CODES.filter((entry) => entry.bodyPart === bodyPart);
}

/**
 * Search CPT codes by description keyword.
 */
export function searchCPTCodes(keyword: string): CPTCodeEntry[] {
  const lower = keyword.toLowerCase();
  return RADIOLOGY_CPT_CODES.filter(
    (entry) =>
      entry.description.toLowerCase().includes(lower) ||
      entry.code.includes(keyword),
  );
}
