import { doorGroupingKey, isValidAxTraxLocation, parseLocation } from '../src/doors/location';

describe('parseLocation', () => {
  it('groups entry/exit of the same door and strips direction from the name', () => {
    const inn = parseLocation('3\\Panel 1\\Et. 4 Intrare fata Drivenets');
    const out = parseLocation('3\\Panel 1\\Et. 4 Iesire fata Drivenets');

    expect(inn.suggestedRole).toBe('IN');
    expect(out.suggestedRole).toBe('OUT');
    expect(inn.suggestedName).toBe('fata Drivenets');
    expect(out.suggestedName).toBe('fata Drivenets');
    expect(inn.floor).toBe('Et. 4');
    expect(doorGroupingKey(inn.suggestedName, inn.floor)).toBe(
      doorGroupingKey(out.suggestedName, out.floor),
    );
  });

  it('treats Parter as a floor and leaves the rest as the door name', () => {
    const parsed = parseLocation('1\\Panel 2\\Parter Cantina');
    expect(parsed.floor).toBe('Parter');
    expect(parsed.suggestedName).toBe('Cantina');
    expect(parsed.suggestedRole).toBe('NEUTRAL');
  });

  it('rejects PDF header leftovers as reader locations', () => {
    expect(isValidAxTraxLocation('EventLocationDate Access Granted')).toBe(false);
    expect(isValidAxTraxLocation('3\\Panel 1\\Et. 4 Intrare fata Drivenets')).toBe(true);
  });
});
