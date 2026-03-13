import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseHL7Message,
  buildHL7Message,
  generateACK,
  unescapeHL7,
} from '../services/hl7-parser';
import type { HL7Message, HL7Delimiters } from '../services/hl7-parser';

// Sample ORM^O01 message
const SAMPLE_ORM = [
  'MSH|^~\\&|OrderApp|OrderFac|RadApp|RadFac|20240115103045||ORM^O01|MSG00001|P|2.5.1',
  'PID|||MRN12345^^^MRN||Doe^John^Michael||19800115|M|||123 Main St^^Springfield^IL^62704^US|||||||ACCT001',
  'ORC|NW|ORD001||||||||||1234567893^Smith^Jane',
  'OBR|1||ORD001|73721^MRI Lower Extremity without Contrast^CPT|ROUTINE|20240120|||||||Lower back pain radiating to left leg||||||||||||F',
  'IN1|1|BCBS001||Blue Cross Blue Shield||||GRP100||||||||Doe^John|SELF|||||||||||||||||||SUBID001',
].join('\r');

describe('HL7 Parser', () => {
  describe('parseHL7Message', () => {
    it('parses a valid ORM^O01 message', () => {
      const msg = parseHL7Message(SAMPLE_ORM);
      assert.equal(msg.messageType, 'ORM');
      assert.equal(msg.messageEvent, 'O01');
      assert.equal(msg.messageControlId, 'MSG00001');
      assert.equal(msg.version, '2.5.1');
    });

    it('extracts sending and receiving application/facility', () => {
      const msg = parseHL7Message(SAMPLE_ORM);
      assert.equal(msg.sendingApplication, 'OrderApp');
      assert.equal(msg.sendingFacility, 'OrderFac');
      assert.equal(msg.receivingApplication, 'RadApp');
      assert.equal(msg.receivingFacility, 'RadFac');
    });

    it('extracts the datetime from MSH-7', () => {
      const msg = parseHL7Message(SAMPLE_ORM);
      assert.equal(msg.dateTime, '20240115103045');
    });

    it('parses correct number of segments', () => {
      const msg = parseHL7Message(SAMPLE_ORM);
      assert.equal(msg.segments.length, 5);
      assert.equal(msg.segments[0].name, 'MSH');
      assert.equal(msg.segments[1].name, 'PID');
      assert.equal(msg.segments[2].name, 'ORC');
      assert.equal(msg.segments[3].name, 'OBR');
      assert.equal(msg.segments[4].name, 'IN1');
    });

    it('extracts patient information from PID segment', () => {
      const msg = parseHL7Message(SAMPLE_ORM);
      assert.ok(msg.patient);
      assert.equal(msg.patient!.lastName, 'Doe');
      assert.equal(msg.patient!.firstName, 'John');
      assert.equal(msg.patient!.middleName, 'Michael');
      assert.equal(msg.patient!.dateOfBirth, '19800115');
      assert.equal(msg.patient!.gender, 'M');
    });

    it('extracts patient address', () => {
      const msg = parseHL7Message(SAMPLE_ORM);
      assert.ok(msg.patient);
      assert.equal(msg.patient!.address.street, '123 Main St');
      assert.equal(msg.patient!.address.city, 'Springfield');
      assert.equal(msg.patient!.address.state, 'IL');
      assert.equal(msg.patient!.address.zip, '62704');
      assert.equal(msg.patient!.address.country, 'US');
    });

    it('extracts patient MRN from PID-3', () => {
      const msg = parseHL7Message(SAMPLE_ORM);
      assert.ok(msg.patient);
      assert.equal(msg.patient!.mrn, 'MRN12345');
      assert.equal(msg.patient!.externalId, 'MRN12345');
    });

    it('extracts order information from ORC/OBR segments', () => {
      const msg = parseHL7Message(SAMPLE_ORM);
      assert.ok(msg.order);
      assert.equal(msg.order!.orderControl, 'NW');
      assert.equal(msg.order!.placerOrderNumber, 'ORD001');
      assert.equal(msg.order!.universalServiceId, '73721');
      assert.equal(msg.order!.universalServiceText, 'MRI Lower Extremity without Contrast');
      assert.equal(msg.order!.priority, 'ROUTINE');
    });

    it('extracts clinical info from OBR-13', () => {
      const msg = parseHL7Message(SAMPLE_ORM);
      assert.ok(msg.order);
      assert.equal(msg.order!.clinicalInfo, 'Lower back pain radiating to left leg');
    });

    it('extracts insurance information from IN1 segment', () => {
      const msg = parseHL7Message(SAMPLE_ORM);
      assert.ok(msg.insurance);
      assert.equal(msg.insurance!.planId, 'BCBS001');
      assert.equal(msg.insurance!.planName, 'Blue Cross Blue Shield');
    });

    it('parses delimiters correctly', () => {
      const msg = parseHL7Message(SAMPLE_ORM);
      assert.equal(msg.delimiters.field, '|');
      assert.equal(msg.delimiters.component, '^');
      assert.equal(msg.delimiters.repetition, '~');
      assert.equal(msg.delimiters.escape, '\\');
      assert.equal(msg.delimiters.subcomponent, '&');
    });

    it('handles \\n line endings', () => {
      const msg = parseHL7Message(SAMPLE_ORM.replace(/\r/g, '\n'));
      assert.equal(msg.messageType, 'ORM');
      assert.equal(msg.segments.length, 5);
    });

    it('handles \\r\\n line endings', () => {
      const msg = parseHL7Message(SAMPLE_ORM.replace(/\r/g, '\r\n'));
      assert.equal(msg.messageType, 'ORM');
      assert.equal(msg.segments.length, 5);
    });

    it('throws on empty message', () => {
      assert.throws(() => parseHL7Message(''), /Empty HL7 message/);
    });

    it('throws on message not starting with MSH', () => {
      assert.throws(() => parseHL7Message('PID|||12345'), /must start with MSH/);
    });

    it('generates a UUID for the parsed message id', () => {
      const msg = parseHL7Message(SAMPLE_ORM);
      assert.ok(msg.id);
      assert.ok(msg.id.length > 0);
    });
  });

  describe('buildHL7Message', () => {
    it('builds a valid HL7 message with MSH segment', () => {
      const result = buildHL7Message({
        sendingApplication: 'TestApp',
        sendingFacility: 'TestFac',
        receivingApplication: 'RecvApp',
        receivingFacility: 'RecvFac',
        messageType: 'ORM',
        messageEvent: 'O01',
        messageControlId: 'CTRL001',
        version: '2.5.1',
        segments: [],
      });

      assert.ok(result.startsWith('MSH|^~\\&|'));
      assert.ok(result.includes('TestApp'));
      assert.ok(result.includes('TestFac'));
      assert.ok(result.includes('RecvApp'));
      assert.ok(result.includes('RecvFac'));
      assert.ok(result.includes('ORM^O01'));
      assert.ok(result.includes('CTRL001'));
      assert.ok(result.includes('2.5.1'));
    });

    it('includes additional segments', () => {
      const result = buildHL7Message({
        sendingApplication: 'App',
        sendingFacility: 'Fac',
        receivingApplication: 'RApp',
        receivingFacility: 'RFac',
        messageType: 'ADT',
        messageEvent: 'A01',
        segments: [
          { name: 'PID', fields: ['', '', 'MRN123^^^MRN', '', 'Doe^John'] },
        ],
      });

      assert.ok(result.includes('PID|'));
      assert.ok(result.includes('MRN123'));
      assert.ok(result.includes('Doe^John'));
    });

    it('generates a control ID if not provided', () => {
      const result = buildHL7Message({
        sendingApplication: 'App',
        sendingFacility: 'Fac',
        receivingApplication: 'RApp',
        receivingFacility: 'RFac',
        messageType: 'ORM',
        messageEvent: 'O01',
        segments: [],
      });

      // The message should have a non-empty control ID field (MSH-10)
      const segments = result.split('\r');
      const mshFields = segments[0].split('|');
      assert.ok(mshFields[9]); // MSH-10 (0-indexed: MSH=0, |=1, ^~\&=2, ...)
      assert.ok(mshFields[9].length > 0);
    });

    it('defaults to version 2.5.1', () => {
      const result = buildHL7Message({
        sendingApplication: 'App',
        sendingFacility: 'Fac',
        receivingApplication: 'RApp',
        receivingFacility: 'RFac',
        messageType: 'ORM',
        messageEvent: 'O01',
        segments: [],
      });

      assert.ok(result.includes('2.5.1'));
    });

    it('ends with segment separator', () => {
      const result = buildHL7Message({
        sendingApplication: 'App',
        sendingFacility: 'Fac',
        receivingApplication: 'RApp',
        receivingFacility: 'RFac',
        messageType: 'ORM',
        messageEvent: 'O01',
        segments: [],
      });

      assert.ok(result.endsWith('\r'));
    });

    it('built message can be parsed back', () => {
      const built = buildHL7Message({
        sendingApplication: 'TestApp',
        sendingFacility: 'TestFac',
        receivingApplication: 'RecvApp',
        receivingFacility: 'RecvFac',
        messageType: 'ORM',
        messageEvent: 'O01',
        messageControlId: 'ROUND-TRIP-001',
        version: '2.5.1',
        segments: [
          { name: 'PID', fields: ['', '', 'MRN999^^^MRN', '', 'Smith^Jane'] },
        ],
      });

      const parsed = parseHL7Message(built);
      assert.equal(parsed.messageType, 'ORM');
      assert.equal(parsed.messageEvent, 'O01');
      assert.equal(parsed.messageControlId, 'ROUND-TRIP-001');
      assert.equal(parsed.sendingApplication, 'TestApp');
      assert.equal(parsed.receivingApplication, 'RecvApp');
    });
  });

  describe('generateACK', () => {
    let originalMessage: HL7Message;

    it('generates an AA (accept) acknowledgment', () => {
      originalMessage = parseHL7Message(SAMPLE_ORM);
      const ack = generateACK(originalMessage, 'AA');

      assert.ok(ack.includes('MSH|'));
      assert.ok(ack.includes('ACK'));
      assert.ok(ack.includes('MSA|AA|MSG00001'));
    });

    it('swaps sending and receiving in the ACK', () => {
      originalMessage = parseHL7Message(SAMPLE_ORM);
      const ack = generateACK(originalMessage, 'AA');

      // The ACK should have the original receiving app/fac as its sending
      const segments = ack.split('\r').filter((s) => s.length > 0);
      const mshFields = segments[0].split('|');
      // MSH-3 (sending app) should be original MSH-5 (receiving app)
      assert.equal(mshFields[2], 'RadApp');
      // MSH-4 (sending fac) should be original MSH-6 (receiving fac)
      assert.equal(mshFields[3], 'RadFac');
      // MSH-5 (receiving app) should be original MSH-3 (sending app)
      assert.equal(mshFields[4], 'OrderApp');
      // MSH-6 (receiving fac) should be original MSH-4 (sending fac)
      assert.equal(mshFields[5], 'OrderFac');
    });

    it('generates an AE (error) acknowledgment with error message', () => {
      originalMessage = parseHL7Message(SAMPLE_ORM);
      const ack = generateACK(originalMessage, 'AE', 'Invalid procedure code');

      assert.ok(ack.includes('MSA|AE|MSG00001|Invalid procedure code'));
      // Should include ERR segment for errors
      assert.ok(ack.includes('ERR|'));
    });

    it('generates an AR (reject) acknowledgment', () => {
      originalMessage = parseHL7Message(SAMPLE_ORM);
      const ack = generateACK(originalMessage, 'AR', 'Message rejected');

      assert.ok(ack.includes('MSA|AR|MSG00001'));
      assert.ok(ack.includes('ERR|'));
    });

    it('does not include ERR segment for AA ack', () => {
      originalMessage = parseHL7Message(SAMPLE_ORM);
      const ack = generateACK(originalMessage, 'AA');

      assert.ok(!ack.includes('ERR|'));
    });

    it('preserves the original message version', () => {
      originalMessage = parseHL7Message(SAMPLE_ORM);
      const ack = generateACK(originalMessage, 'AA');

      assert.ok(ack.includes('2.5.1'));
    });

    it('references the original message control ID in MSA-2', () => {
      originalMessage = parseHL7Message(SAMPLE_ORM);
      const ack = generateACK(originalMessage, 'AA');

      const segments = ack.split('\r').filter((s) => s.length > 0);
      const msaSegment = segments.find((s) => s.startsWith('MSA'));
      assert.ok(msaSegment);
      const msaFields = msaSegment!.split('|');
      assert.equal(msaFields[2], 'MSG00001');
    });
  });

  describe('unescapeHL7', () => {
    const delimiters: HL7Delimiters = {
      field: '|',
      component: '^',
      repetition: '~',
      escape: '\\',
      subcomponent: '&',
    };

    it('unescapes field separator \\F\\', () => {
      assert.equal(unescapeHL7('test\\F\\value', delimiters), 'test|value');
    });

    it('unescapes component separator \\S\\', () => {
      assert.equal(unescapeHL7('test\\S\\value', delimiters), 'test^value');
    });

    it('unescapes subcomponent separator \\T\\', () => {
      assert.equal(unescapeHL7('test\\T\\value', delimiters), 'test&value');
    });

    it('unescapes repetition separator \\R\\', () => {
      assert.equal(unescapeHL7('test\\R\\value', delimiters), 'test~value');
    });

    it('unescapes escape character \\E\\', () => {
      assert.equal(unescapeHL7('test\\E\\value', delimiters), 'test\\value');
    });

    it('handles multiple escape sequences in one string', () => {
      assert.equal(
        unescapeHL7('a\\F\\b\\S\\c\\T\\d', delimiters),
        'a|b^c&d',
      );
    });

    it('returns string unchanged if no escape sequences', () => {
      assert.equal(unescapeHL7('no escapes here', delimiters), 'no escapes here');
    });
  });
});
