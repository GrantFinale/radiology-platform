import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

// HL7v2 delimiters
const SEGMENT_SEPARATOR = '\r';
const DEFAULT_FIELD_SEPARATOR = '|';
const DEFAULT_COMPONENT_SEPARATOR = '^';
const DEFAULT_REPETITION_SEPARATOR = '~';
const DEFAULT_ESCAPE_CHARACTER = '\\';
const DEFAULT_SUBCOMPONENT_SEPARATOR = '&';

export interface HL7Delimiters {
  field: string;
  component: string;
  repetition: string;
  escape: string;
  subcomponent: string;
}

export interface HL7Field {
  value: string;
  components: HL7Component[];
  repetitions: HL7Field[];
}

export interface HL7Component {
  value: string;
  subcomponents: string[];
}

export interface HL7Segment {
  name: string;
  fields: HL7Field[];
  raw: string;
}

export interface HL7Message {
  id: string;
  raw: string;
  delimiters: HL7Delimiters;
  segments: HL7Segment[];
  messageType: string;
  messageEvent: string;
  messageControlId: string;
  sendingApplication: string;
  sendingFacility: string;
  receivingApplication: string;
  receivingFacility: string;
  dateTime: string;
  version: string;
  patient?: HL7Patient;
  order?: HL7Order;
  results?: HL7Result[];
  schedule?: HL7Schedule;
  insurance?: HL7Insurance;
}

export interface HL7Patient {
  id: string;
  externalId: string;
  lastName: string;
  firstName: string;
  middleName: string;
  dateOfBirth: string;
  gender: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  phone: string;
  ssn: string;
  accountNumber: string;
  mrn: string;
}

export interface HL7Order {
  placerOrderNumber: string;
  fillerOrderNumber: string;
  orderControl: string;
  orderStatus: string;
  universalServiceId: string;
  universalServiceText: string;
  priority: string;
  requestedDateTime: string;
  orderingProvider: {
    id: string;
    lastName: string;
    firstName: string;
  };
  clinicalInfo: string;
  resultStatus: string;
}

export interface HL7Result {
  setId: string;
  observationId: string;
  observationText: string;
  value: string;
  units: string;
  referenceRange: string;
  abnormalFlag: string;
  status: string;
  dateTime: string;
}

export interface HL7Schedule {
  placerAppointmentId: string;
  fillerAppointmentId: string;
  eventReason: string;
  appointmentDateTime: string;
  appointmentDuration: string;
  fillerStatus: string;
  location: string;
}

export interface HL7Insurance {
  planId: string;
  planName: string;
  groupNumber: string;
  subscriberId: string;
  subscriberName: string;
  insuredRelationship: string;
}

function parseDelimiters(mshSegment: string): HL7Delimiters {
  // MSH|^~\&| — characters after MSH are: field(|), then encoding chars (^~\&)
  if (mshSegment.length < 8) {
    return {
      field: DEFAULT_FIELD_SEPARATOR,
      component: DEFAULT_COMPONENT_SEPARATOR,
      repetition: DEFAULT_REPETITION_SEPARATOR,
      escape: DEFAULT_ESCAPE_CHARACTER,
      subcomponent: DEFAULT_SUBCOMPONENT_SEPARATOR,
    };
  }
  return {
    field: mshSegment[3],
    component: mshSegment[4],
    repetition: mshSegment[5],
    escape: mshSegment[6],
    subcomponent: mshSegment[7],
  };
}

function parseComponent(raw: string, delimiters: HL7Delimiters): HL7Component {
  const subcomponents = raw.split(delimiters.subcomponent);
  return {
    value: subcomponents[0] || '',
    subcomponents,
  };
}

function parseField(raw: string, delimiters: HL7Delimiters): HL7Field {
  // Handle repetitions first
  const reps = raw.split(delimiters.repetition);

  const components = reps[0].split(delimiters.component).map((c) => parseComponent(c, delimiters));

  const field: HL7Field = {
    value: components[0]?.value || '',
    components,
    repetitions: [],
  };

  if (reps.length > 1) {
    field.repetitions = reps.slice(1).map((rep) => {
      const repComponents = rep.split(delimiters.component).map((c) => parseComponent(c, delimiters));
      return {
        value: repComponents[0]?.value || '',
        components: repComponents,
        repetitions: [],
      };
    });
  }

  return field;
}

function parseSegment(raw: string, delimiters: HL7Delimiters): HL7Segment {
  const name = raw.substring(0, 3);

  if (name === 'MSH') {
    // MSH is special: MSH.1 is the field separator, MSH.2 is the encoding characters
    const afterEncoding = raw.substring(8); // skip "MSH|^~\&"
    const restFields = afterEncoding ? afterEncoding.split(delimiters.field) : [];
    // Build MSH fields: index 0 = field separator, index 1 = encoding chars, then rest
    const fields: HL7Field[] = [
      { value: delimiters.field, components: [{ value: delimiters.field, subcomponents: [delimiters.field] }], repetitions: [] },
      {
        value: `${delimiters.component}${delimiters.repetition}${delimiters.escape}${delimiters.subcomponent}`,
        components: [{
          value: `${delimiters.component}${delimiters.repetition}${delimiters.escape}${delimiters.subcomponent}`,
          subcomponents: [`${delimiters.component}${delimiters.repetition}${delimiters.escape}${delimiters.subcomponent}`],
        }],
        repetitions: [],
      },
    ];

    // The first element of restFields is empty (from the | after encoding chars) if present
    const startIdx = restFields[0] === '' ? 1 : 0;
    for (let i = startIdx; i < restFields.length; i++) {
      fields.push(parseField(restFields[i], delimiters));
    }

    return { name, fields, raw };
  }

  const parts = raw.split(delimiters.field);
  const fields = parts.slice(1).map((f) => parseField(f, delimiters));

  return { name, fields, raw };
}

function getFieldValue(segment: HL7Segment | undefined, fieldIndex: number, componentIndex = 0): string {
  if (!segment) return '';
  // For MSH, field indices are already 0-based in our array
  // For other segments, field index 1 = array index 0
  const adjustedIndex = segment.name === 'MSH' ? fieldIndex - 1 : fieldIndex - 1;
  const field = segment.fields[adjustedIndex];
  if (!field) return '';
  if (componentIndex === 0) return field.value;
  const comp = field.components[componentIndex - 1];
  return comp?.value || '';
}

function findSegment(segments: HL7Segment[], name: string): HL7Segment | undefined {
  return segments.find((s) => s.name === name);
}

function findAllSegments(segments: HL7Segment[], name: string): HL7Segment[] {
  return segments.filter((s) => s.name === name);
}

function extractPatient(segments: HL7Segment[]): HL7Patient | undefined {
  const pid = findSegment(segments, 'PID');
  if (!pid) return undefined;

  return {
    id: uuidv4(),
    externalId: getFieldValue(pid, 3, 1), // PID.3.1 — Patient ID
    lastName: getFieldValue(pid, 5, 1),   // PID.5.1 — Family name
    firstName: getFieldValue(pid, 5, 2),  // PID.5.2 — Given name
    middleName: getFieldValue(pid, 5, 3), // PID.5.3 — Middle name
    dateOfBirth: getFieldValue(pid, 7),   // PID.7 — Date of birth
    gender: getFieldValue(pid, 8),        // PID.8 — Sex
    address: {
      street: getFieldValue(pid, 11, 1),  // PID.11.1 — Street
      city: getFieldValue(pid, 11, 3),    // PID.11.3 — City
      state: getFieldValue(pid, 11, 4),   // PID.11.4 — State
      zip: getFieldValue(pid, 11, 5),     // PID.11.5 — Zip
      country: getFieldValue(pid, 11, 6), // PID.11.6 — Country
    },
    phone: getFieldValue(pid, 13, 1),     // PID.13 — Phone
    ssn: getFieldValue(pid, 19),          // PID.19 — SSN
    accountNumber: getFieldValue(pid, 18),// PID.18 — Patient account number
    mrn: getFieldValue(pid, 3, 1),        // Same as external ID (MRN)
  };
}

function extractOrder(segments: HL7Segment[]): HL7Order | undefined {
  const orc = findSegment(segments, 'ORC');
  const obr = findSegment(segments, 'OBR');
  if (!orc && !obr) return undefined;

  return {
    placerOrderNumber: getFieldValue(orc, 2, 1),   // ORC.2 — Placer order number
    fillerOrderNumber: getFieldValue(orc, 3, 1),   // ORC.3 — Filler order number
    orderControl: getFieldValue(orc, 1),            // ORC.1 — Order control
    orderStatus: getFieldValue(orc, 5),             // ORC.5 — Order status
    universalServiceId: getFieldValue(obr, 4, 1),  // OBR.4.1 — Service ID
    universalServiceText: getFieldValue(obr, 4, 2),// OBR.4.2 — Service text
    priority: getFieldValue(obr, 5),                // OBR.5 — Priority
    requestedDateTime: getFieldValue(obr, 6),       // OBR.6 — Requested date
    orderingProvider: {
      id: getFieldValue(obr, 16, 1),                // OBR.16.1 — Provider ID
      lastName: getFieldValue(obr, 16, 2),           // OBR.16.2 — Last name
      firstName: getFieldValue(obr, 16, 3),          // OBR.16.3 — First name
    },
    clinicalInfo: getFieldValue(obr, 13),            // OBR.13 — Clinical info
    resultStatus: getFieldValue(obr, 25),            // OBR.25 — Result status
  };
}

function extractResults(segments: HL7Segment[]): HL7Result[] {
  const obxSegments = findAllSegments(segments, 'OBX');
  return obxSegments.map((obx) => ({
    setId: getFieldValue(obx, 1),              // OBX.1 — Set ID
    observationId: getFieldValue(obx, 3, 1),   // OBX.3.1 — Observation ID
    observationText: getFieldValue(obx, 3, 2), // OBX.3.2 — Observation text
    value: getFieldValue(obx, 5),              // OBX.5 — Observation value
    units: getFieldValue(obx, 6, 1),           // OBX.6.1 — Units
    referenceRange: getFieldValue(obx, 7),     // OBX.7 — Reference range
    abnormalFlag: getFieldValue(obx, 8),       // OBX.8 — Abnormal flags
    status: getFieldValue(obx, 11),            // OBX.11 — Observation result status
    dateTime: getFieldValue(obx, 14),          // OBX.14 — Date/time
  }));
}

function extractSchedule(segments: HL7Segment[]): HL7Schedule | undefined {
  const sch = findSegment(segments, 'SCH');
  if (!sch) return undefined;

  return {
    placerAppointmentId: getFieldValue(sch, 1, 1), // SCH.1 — Placer appt ID
    fillerAppointmentId: getFieldValue(sch, 2, 1), // SCH.2 — Filler appt ID
    eventReason: getFieldValue(sch, 6, 1),         // SCH.6 — Event reason
    appointmentDateTime: getFieldValue(sch, 11),   // SCH.11 — Appt timing
    appointmentDuration: getFieldValue(sch, 9),    // SCH.9 — Duration
    fillerStatus: getFieldValue(sch, 25),          // SCH.25 — Filler status
    location: getFieldValue(sch, 23, 1),           // SCH.23 — Location
  };
}

function extractInsurance(segments: HL7Segment[]): HL7Insurance | undefined {
  const in1 = findSegment(segments, 'IN1');
  if (!in1) return undefined;

  return {
    planId: getFieldValue(in1, 2, 1),          // IN1.2 — Plan ID
    planName: getFieldValue(in1, 4, 1),        // IN1.4 — Plan name
    groupNumber: getFieldValue(in1, 8, 1),     // IN1.8 — Group number
    subscriberId: getFieldValue(in1, 36, 1),   // IN1.36 — Subscriber ID
    subscriberName: getFieldValue(in1, 16, 1), // IN1.16 — Subscriber name
    insuredRelationship: getFieldValue(in1, 17),// IN1.17 — Relationship
  };
}

export function parseHL7Message(raw: string): HL7Message {
  // Normalize line endings
  const normalized = raw.replace(/\r\n/g, '\r').replace(/\n/g, '\r');
  const segmentStrings = normalized.split(SEGMENT_SEPARATOR).filter((s) => s.trim().length > 0);

  if (segmentStrings.length === 0) {
    throw new Error('Empty HL7 message');
  }

  const mshRaw = segmentStrings[0];
  if (!mshRaw.startsWith('MSH')) {
    throw new Error('HL7 message must start with MSH segment');
  }

  const delimiters = parseDelimiters(mshRaw);
  const segments = segmentStrings.map((s) => parseSegment(s, delimiters));
  const msh = segments[0];

  // MSH fields: 1=separator, 2=encoding, 3=sending app, 4=sending facility,
  // 5=receiving app, 6=receiving facility, 7=datetime, 8=security, 9=message type,
  // 10=message control ID, 11=processing ID, 12=version
  const messageType = getFieldValue(msh, 9, 1);  // MSH.9.1
  const messageEvent = getFieldValue(msh, 9, 2); // MSH.9.2

  const message: HL7Message = {
    id: uuidv4(),
    raw: normalized,
    delimiters,
    segments,
    messageType,
    messageEvent,
    messageControlId: getFieldValue(msh, 10),     // MSH.10
    sendingApplication: getFieldValue(msh, 3),     // MSH.3
    sendingFacility: getFieldValue(msh, 4),        // MSH.4
    receivingApplication: getFieldValue(msh, 5),   // MSH.5
    receivingFacility: getFieldValue(msh, 6),      // MSH.6
    dateTime: getFieldValue(msh, 7),               // MSH.7
    version: getFieldValue(msh, 12),               // MSH.12
  };

  // Extract structured data based on message type
  message.patient = extractPatient(segments);

  if (messageType === 'ORM' || messageType === 'ORU') {
    message.order = extractOrder(segments);
  }
  if (messageType === 'ORU') {
    message.results = extractResults(segments);
  }
  if (messageType === 'SIU') {
    message.schedule = extractSchedule(segments);
  }

  message.insurance = extractInsurance(segments);

  logger.debug('Parsed HL7 message', {
    messageType: `${messageType}^${messageEvent}`,
    controlId: message.messageControlId,
    segmentCount: segments.length,
  });

  return message;
}

export interface BuildHL7Options {
  sendingApplication: string;
  sendingFacility: string;
  receivingApplication: string;
  receivingFacility: string;
  messageType: string;
  messageEvent: string;
  messageControlId?: string;
  version?: string;
  segments: Array<{
    name: string;
    fields: string[];
  }>;
}

export function buildHL7Message(options: BuildHL7Options): string {
  const controlId = options.messageControlId || uuidv4().replace(/-/g, '').substring(0, 20);
  const dateTime = formatHL7DateTime(new Date());
  const version = options.version || '2.5.1';

  const msh = [
    'MSH',
    '^~\\&',
    options.sendingApplication,
    options.sendingFacility,
    options.receivingApplication,
    options.receivingFacility,
    dateTime,
    '',
    `${options.messageType}^${options.messageEvent}`,
    controlId,
    'P',
    version,
  ].join('|');

  const allSegments = [msh];
  for (const seg of options.segments) {
    allSegments.push([seg.name, ...seg.fields].join('|'));
  }

  return allSegments.join(SEGMENT_SEPARATOR) + SEGMENT_SEPARATOR;
}

export type ACKCode = 'AA' | 'AE' | 'AR';

export function generateACK(
  originalMessage: HL7Message,
  ackCode: ACKCode,
  errorMessage?: string,
): string {
  const dateTime = formatHL7DateTime(new Date());
  const controlId = uuidv4().replace(/-/g, '').substring(0, 20);

  const msh = [
    'MSH',
    '^~\\&',
    originalMessage.receivingApplication,
    originalMessage.receivingFacility,
    originalMessage.sendingApplication,
    originalMessage.sendingFacility,
    dateTime,
    '',
    'ACK',
    controlId,
    'P',
    originalMessage.version || '2.5.1',
  ].join('|');

  const msaFields = [
    'MSA',
    ackCode,
    originalMessage.messageControlId,
  ];
  if (errorMessage) {
    msaFields.push(errorMessage);
  }
  const msa = msaFields.join('|');

  const segments = [msh, msa];

  // Add ERR segment for errors
  if (ackCode !== 'AA' && errorMessage) {
    const err = ['ERR', '', '', '', '', errorMessage].join('|');
    segments.push(err);
  }

  return segments.join(SEGMENT_SEPARATOR) + SEGMENT_SEPARATOR;
}

function formatHL7DateTime(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${y}${m}${d}${h}${min}${s}`;
}

/**
 * Unescape HL7 escape sequences
 */
export function unescapeHL7(value: string, delimiters: HL7Delimiters): string {
  const esc = delimiters.escape;
  return value
    .replace(new RegExp(`${escapeRegex(esc)}F${escapeRegex(esc)}`, 'g'), delimiters.field)
    .replace(new RegExp(`${escapeRegex(esc)}S${escapeRegex(esc)}`, 'g'), delimiters.component)
    .replace(new RegExp(`${escapeRegex(esc)}T${escapeRegex(esc)}`, 'g'), delimiters.subcomponent)
    .replace(new RegExp(`${escapeRegex(esc)}R${escapeRegex(esc)}`, 'g'), delimiters.repetition)
    .replace(new RegExp(`${escapeRegex(esc)}E${escapeRegex(esc)}`, 'g'), delimiters.escape);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
