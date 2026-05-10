import { describe, it, expect } from 'vitest'
import { itmStatus } from './option-itm'
import { v1OptionType } from '@/lib/api/generated/models/v1OptionType'

describe('itmStatus', () => {
  it('CALL is ITM when underlying > strike', () => {
    expect(itmStatus(v1OptionType.OPTION_TYPE_CALL, '210', '190')).toBe('itm')
    expect(itmStatus(v1OptionType.OPTION_TYPE_CALL, '190', '190')).toBe('oom')
    expect(itmStatus(v1OptionType.OPTION_TYPE_CALL, '180', '190')).toBe('oom')
  })

  it('PUT is ITM when underlying < strike (spec p.61.d worked example)', () => {
    expect(itmStatus(v1OptionType.OPTION_TYPE_PUT, '15', '19')).toBe('itm')
    expect(itmStatus(v1OptionType.OPTION_TYPE_PUT, '19', '19')).toBe('oom')
    expect(itmStatus(v1OptionType.OPTION_TYPE_PUT, '25', '19')).toBe('oom')
  })

  it('returns unknown when inputs are missing or invalid', () => {
    expect(itmStatus(undefined, '15', '19')).toBe('unknown')
    expect(itmStatus(v1OptionType.OPTION_TYPE_PUT, undefined, '19')).toBe('unknown')
    expect(itmStatus(v1OptionType.OPTION_TYPE_PUT, '15', undefined)).toBe('unknown')
    expect(itmStatus(v1OptionType.OPTION_TYPE_PUT, 'abc', '19')).toBe('unknown')
  })
})
