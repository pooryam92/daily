import { expect, test } from './daily'

test('the theme is applied to the window and kept across restarts', async ({ daily }) => {
  await daily.openSettings()
  await daily.page.getByRole('radio', { name: 'Light' }).click()

  await expect(daily.page.getByRole('radio', { name: 'Light' })).toBeChecked()
  expect(await daily.app.evaluate(({ nativeTheme }) => nativeTheme.themeSource)).toBe('light')
  await expect.poll(() => daily.settings()).toMatchObject({ theme: 'light' })

  await daily.restart()

  expect(await daily.app.evaluate(({ nativeTheme }) => nativeTheme.themeSource)).toBe('light')
  await daily.openSettings()
  await expect(daily.page.getByRole('radio', { name: 'Light' })).toBeChecked()
})

test('the settings name the version of the app', async ({ daily }) => {
  const version = await daily.app.evaluate(({ app }) => app.getVersion())

  await daily.openSettings()

  await expect(daily.page.getByText(`Daily ${version}`)).toBeVisible()
})
