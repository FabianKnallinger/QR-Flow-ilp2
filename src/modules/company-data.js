// Fixed ilp2 company/contact presets. Kept in one place so the "Standort"
// (office location) preset, the Position dropdown and the phone prefix stay
// consistent wherever they're used in the form.

export const COMPANY_NAME = 'ILP² INGENIEURE GmbH & Co. KG'
export const COMPANY_WEBSITE = 'www.ilp2.de'
export const COMPANY_COUNTRY = 'Deutschland'
export const PHONE_PREFIX = '+49 89 22 840 983'

export const OFFICE_LOCATIONS = [
  { id: 'muenchen', label: 'München', street: 'Koppstraße 14', zip: '81379', city: 'München' },
  { id: 'miesbach', label: 'Miesbach', street: 'Marktplatz 4A', zip: '83714', city: 'Miesbach' },
  { id: 'rosenheim', label: 'Rosenheim', street: 'Aventinstraße 2a', zip: '83022', city: 'Rosenheim' },
]

export const POSITION_OPTIONS = [
  'Geschäftsführung',
  'Officemanagerin',
  'Projektingenieurin',
  'Projektingenieur',
  'Junior-Projektleiterin',
  'Projektleiterin',
  'Projektleiter',
  'Verwaltung',
  'Konstrukteurin',
  'Konstrukteur',
  'Prokurist',
  'Prokuristin',
  'Teamleiter',
  'Teamleiterin',
  'Niederlassungsleiter',
  'Leitung Personal und Office',
  'Staatlich geprüfter Bautechniker',
]
