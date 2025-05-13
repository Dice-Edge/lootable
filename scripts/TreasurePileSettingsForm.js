export class TreasurePileSettingsForm extends FormApplication {

  constructor() {
    super();
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      title: game.i18n.localize('LOOTABLE.settings.tsrplSettings.name'),
      template: 'modules/lootable/templates/tsrplSettings.hbs',
      id: 'tsrpl-settings',
      width: 500,
      height: 'auto',
      closeOnSubmit: true
    });
  }

  async getData() {
    const defaultTables = game.settings.get('lootable', 'treasurePileDefaultTables') || [];
    const tables = defaultTables.map(id => {
      const table = game.tables.get(id);
      return table ? { id: table.id, name: table.name } : null;
    }).filter(t => t !== null);
    return {
      settings: {
        disableTreasurePile: game.settings.get('lootable', 'disableTreasurePile'),
        showAllTables: game.settings.get('lootable', 'treasurePileShowAllTables'),
        generationLimit: game.settings.get('lootable', 'treasurePileGenerationLimit'),
        defaultTables: tables
      }
    };
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find('.select-tables').click(this._onSelectTables.bind(this));
  }
  async _onSelectTables(event) {
    event.preventDefault();
    const defaultTables = game.settings.get('lootable', 'treasurePileDefaultTables') || [];
    const tables = game.tables.contents.map(table => ({
      id: table.id,
      name: table.name,
      selected: defaultTables.includes(table.id)
    })).sort((a, b) => a.name.localeCompare(b.name));
    const content = await renderTemplate('modules/lootable/templates/tsrplTableSelect.hbs', { tables });
    const dialog = new Dialog({
      title: game.i18n.localize('LOOTABLE.settings.tsrplSettings.selectTables'),
      content,
      buttons: {},
      classes: ['table-selector'],
      height: 500,
      resizable: true,
      render: (html) => {
        html.find('form').on('submit', async (event) => {
          event.preventDefault();
          const formData = new FormData(event.target);
          const selectedTables = formData.getAll('selectedTables');
          await game.settings.set('lootable', 'treasurePileDefaultTables', selectedTables);
          dialog.close();
          this.render(true);
        });
      }
    }).render(true);
  }

  async _updateObject(event, formData) {
    await game.settings.set('lootable', 'disableTreasurePile', formData.disableTreasurePile);
    await game.settings.set('lootable', 'treasurePileShowAllTables', formData.showAllTables);
    await game.settings.set('lootable', 'treasurePileGenerationLimit', formData.generationLimit);
    const oldDisableValue = game.settings.get('lootable', 'disableTreasurePile');
    if (oldDisableValue !== formData.disableTreasurePile) {
      Dialog.confirm({
        title: game.i18n.localize('LOOTABLE.reload'),
        content: game.i18n.localize('LOOTABLE.reloadHint'),
        yes: () => window.location.reload(),
        no: () => {},
        defaultYes: true
      });
    }
  }
} 