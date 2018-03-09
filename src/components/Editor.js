import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';

import Section from './Section';
import Item from './Item';
import Select from './controls/Select';

import { localPath, basePath, joinPath } from '../system';
import data from '../data.compiled.json';

const styles = {
  visible: {},
  hidden: {
    visibility: 'hidden',
    height: 0
  }
};

class Editor extends Component {

  static propTypes = {
    settings: PropTypes.object.isRequired,
    onChange: PropTypes.func.isRequired
  };

  change = (data, name) => {
    return value => {
      data[name] = value;
      this.props.onChange({...this.props.settings});
    };
  };

  render () {
    const {settings} = this.props;
    const {configMode, platform} = settings.__internal;
    const base = settings.parity.base_path !== '$BASE' ? settings.parity.base_path : basePath(platform);

    const isOffline = settings.parity.mode === 'offline';
    const isSimple = configMode === 'simple';

    return (
      <div>
        { this.select('__internal', 'platform') }
        { this.select('__internal', 'configMode') }
        <div style={isSimple ? styles.visible : styles.hidden}>
          { this.renderSimple(settings, platform, base, isOffline) }
        </div>
        <div style={!isSimple ? styles.visible : styles.hidden}>
          { this.renderConfig(settings, platform, base, isOffline) }
        </div>
      </div>
    );
  }

  renderSimple (settings, platform, base, isOffline) {
    this.configMode = 'simple';
    return (
      <div>
        <h5>{data.parity.section}</h5>
        <p>{data.parity.description}</p>
        { this.select('parity', 'chain') }
        { this.select('parity', 'mode') }
        { this.select('parity', 'auto_update') }
        { this.select('parity', 'release_track', settings.parity.auto_update !== 'none') }
        { this.path('parity', 'base_path', base, platform) }
        { this.flag('parity', 'no_persistent_txqueue') }
        <h5>{data.footprint.section}</h5>
        <p>{data.footprint.description}</p>
        { this.select('footprint', 'db_compaction') }
        { this.select('footprint', 'pruning') }
        { this.number('footprint', 'pruning_memory', settings.footprint.pruning !== 'archive') }
        { this.select('footprint', 'fat_db') }
        { this.select('footprint', 'tracing') }
        { this.number('footprint', 'cache_size') }
        <Section title={'Servers'} description={'Parity RPC servers configuration'}>
          { this.number('ui', 'port', !settings.ui.disable) }
          { this.text('ui', 'interface', !settings.ui.disable) }
          { this.number('rpc', 'port', !settings.rpc.disable) }
          { this.text('rpc', 'interface', !settings.rpc.disable) }
          { this.text('rpc', 'cors', !settings.rpc.disable) }
          { this.number('websockets', 'port', !settings.websockets.disable) }
          { this.text('websockets', 'interface', !settings.websockets.disable) }
          { this.list('websockets', 'origins', !settings.websockets.disable) }
        </Section>
        <Section title={data.network.section} description={data.network.description}>
          { this.number('network', 'min_peers', !isOffline) }
          { this.number('network', 'max_peers', !isOffline) }
          { this.select('network', 'nat', !isOffline) }
        </Section>
        <Section title={data.mining.section} description={data.mining.description}>
          { this.text('mining', 'author') }
          { this.number('mining', 'usd_per_tx') }
        </Section>
        <Section title={data.misc.section} description={data.misc.description}>
          { this.text('misc', 'logging') }
          { this.text('misc', 'log_file') }
        </Section>
      </div>
    );
  }

  renderConfig (settings, platform, base, isOffline) {
    this.configMode = 'advanced';

    const sections = Object.keys(data).filter(section => section !== '__internal').map(sectionName => {
      const section = data[sectionName];

      let sectionCondition = true;
      if ('condition' in section) {
          // eslint-disable-next-line no-eval
        sectionCondition = eval(section.condition);
      }

      let items = Object.keys(section)
          .filter(key => key !== 'section' && key !== 'description' && key !== 'condition')
          .filter(propName => !section[propName].deprecated)
          .map(propName => {
            const prop = section[propName];

            let condition = sectionCondition;
            if ('disable' in section && propName !== 'disable') {
              condition = condition && !settings[sectionName].disable;
            } else if ('enable' in section && propName !== 'enable') {
              condition = condition && settings[sectionName].enable;
            } else if ('enabled' in section && propName !== 'enabled') {
              condition = condition && settings[sectionName].enabled;
            }

            if ('condition' in prop) {
              // eslint-disable-next-line no-eval
              condition = condition && eval(prop.condition);
            }

            let item;
            if (prop.type === 'bool') {
              item = this.flag(sectionName, propName, condition);
            } else if ('values' in prop) {
              if (prop.type === 'string[]') {
                item = this.multiselect(sectionName, propName, condition);
              } else {
                item = this.select(sectionName, propName, condition);
              }
            } else if (prop.type === 'path') {
              item = this.path(sectionName, propName, base, platform, condition);
            } else if (prop.type === 'string[]') {
              item = this.list(sectionName, propName, condition);
            } else if (prop.type === 'string') {
              item = this.text(sectionName, propName, condition);
            } else if (prop.type === 'number') {
              item = this.number(sectionName, propName, condition);
            }

            return (
              <Fragment key={`${sectionName}.${propName}`}>
                {item}
              </Fragment>
            );
          });

      return (
        <Section key={section.section} title={section.section} description={section.description}>
          { items }
        </Section>
      );
    });

    return (<div>{sections}</div>);
  }

  select (section, prop, isEnabled = true) {
    check(section, prop);

    // TODO [ToDr] hacky
    const {configMode} = this;

    const {settings} = this.props;
    const value = or(settings[section][prop], data[section][prop].default);
    const description = fillDescription(data[section][prop].description[value], value, `${section}.${prop}`);

    return (
      <Item
        title={data[section][prop].name}
        description={description}
        disabled={!isEnabled}
        >
        <Select
          onChange={this.change(settings[section], prop)}
          value={value}
          values={data[section][prop].values.map(val)}
          id={`${configMode}_${prop}`}
          disabled={!isEnabled}
        />
      </Item>
    );
  }

  multiselect (section, prop, isEnabled = true) {
    check(section, prop);

    // TODO [ToDr] hacky
    const {configMode} = this;

    const {settings} = this.props;
    const current = settings[section][prop] || [];
    const description = fillDescription(data[section][prop].description, current);

    const change = (val) => (ev) => {
      const {checked} = ev.target;
      const newValue = [...current];
      const idx = newValue.indexOf(val);

      if (checked) {
        newValue.push(val);
      } else if (idx !== -1) {
        newValue.splice(idx, 1);
      }

      this.change(settings[section], prop)(newValue);
    };

    return (
      <Item
        title={data[section][prop].name}
        description={description}
        disabled={!isEnabled}
        large
        >
        {data[section][prop].values.map(val).map(value => {
          const id = `${configMode}_${section}_${prop}_${value.value}`;

          return (
            <label className='mdl-switch mdl-js-switch' htmlFor={id} key={value.name}>
              <input
                type='checkbox'
                id={id}
                className='mdl-switch__input'
                checked={current.indexOf(value.value) !== -1}
                disabled={!isEnabled}
                onChange={change(value.value)}
                />
              <span className='mdl-switch__label'>{value.name}</span>
            </label>
          );
        })}
      </Item>
    );
  }

  number (section, prop, isEnabled = true) {
    check(section, prop);
    const {settings} = this.props;
    const value = or(settings[section][prop], data[section][prop].default);
    const description = fillDescription(data[section][prop].description, value);

    return (
      <Item
        title={data[section][prop].name}
        description={description}
        disabled={!isEnabled}
        >
        <div className='mdl-textfield mdl-js-textfield mdl-textfield--floating-label'>
          <input
            className='mdl-textfield__input'
            type='number'
            value={value || 0}
            onChange={(ev) => this.change(settings[section], prop)(Number(ev.target.value))}
            min={data[section][prop].min}
            max={data[section][prop].max}
            disabled={!isEnabled}
            />
          <span className='mdl-textfield__error'>Please provide a valid number (min: {data[section][prop].min}, max: {data[section][prop].max})</span>
        </div>
      </Item>
    );
  }

  path (section, prop, base, platform, isEnabled = true) {
    return this.text(section, prop, isEnabled, value => {
      if (!value) {
        return value;
      }
      value = value.replace('$LOCAL', localPath(platform));
      value = value.replace('$BASE', base);
      // normalize separators
      value = joinPath(value.split('\\'), platform);
      value = joinPath(value.split('/'), platform);
      return value;
    });
  }

  text (section, prop, isEnabled = true, processValue = x => x) {
    check(section, prop);
    const {settings} = this.props;
    const value = processValue(or(settings[section][prop], data[section][prop].default));
    const description = fillDescription(data[section][prop].description, value);

    return (
      <Item
        title={data[section][prop].name}
        description={description}
        disabled={!isEnabled}
        >
        <div className='mdl-textfield mdl-js-textfield mdl-textfield--floating-label'>
          <input
            className='mdl-textfield__input'
            type='text'
            value={value || ''}
            onChange={(ev) => this.change(settings[section], prop)(ev.target.value)}
            disabled={!isEnabled}
            />
        </div>
      </Item>
    );
  }

  flag (section, prop, isEnabled = true) {
    check(section, prop);

    // TODO [ToDr] hacky
    const {configMode} = this;

    const {settings} = this.props;
    const value = or(settings[section][prop], data[section][prop].default);
    const description = fillDescription(data[section][prop].description, value);
    const id = `${configMode}_${section}_${prop}`;

    return (
      <Item
        title={data[section][prop].name}
        description={description}
        disabled={!isEnabled}
        >
        <label className='mdl-switch mdl-js-switch' htmlFor={id}>
          <input
            type='checkbox'
            id={id}
            className='mdl-switch__input'
            checked={value}
            disabled={!isEnabled}
            onChange={(ev) => this.change(settings[section], prop)(ev.target.checked)}
            />
          <span className='mdl-switch__label' />
        </label>
      </Item>
    );
  }

  list (section, prop, isEnabled = true) {
    check(section, prop);
    const {settings} = this.props;
    const value = or(settings[section][prop], data[section][prop].default);
    const description = fillDescription(data[section][prop].description, value.toString());

    return (
      <Item
        title={data[section][prop].name}
        description={description}
        disabled={!isEnabled}
        >
        <div className='mdl-textfield mdl-js-textfield mdl-textfield--floating-label'>
          {value.map((v, idx) => (
            <input
              disabled={!isEnabled}
              key={idx}
              className='mdl-textfield__input'
              type='text'
              value={v || ''}
              onChange={(ev) => {
                const newValue = [...value];
                if (ev.target.value !== '') {
                  newValue[idx] = ev.target.value;
                } else {
                  delete newValue[idx];
                }
                this.change(settings[section], prop)(newValue);
              }}
              />
          ))}
          <br />
          <button
            style={{bottom: 0, right: 0, zIndex: 10, transform: 'scale(0.5)'}}
            className='mdl-button mdl-js-button mdl-button--fab mdl-button--mini-fab mdl-js-ripple-effect'
            onClick={() => this.change(settings[section], prop)(value.concat(['']))}
            disabled={!isEnabled}
            >
            <i className='material-icons'>add</i>
          </button>
        </div>
      </Item>
    );
  }
}

export function fillDescription (description, value, key) {
  if (!description) {
    console.warn(`Cant find description for: value:${value} at ${key}`);
    return 'unknown entry';
  }
  return description.replace(/{}/g, value || '');
}

function or (value, def) {
  if (value === undefined) {
    return def;
  }
  return value;
}

function check (section, prop) {
  if (!data[section][prop]) {
    throw new Error(`Can't find data for ${section}.${prop}`);
  }
}

function val (data) {
  const match = data.match(/(.+)\s+\[(.+)]/);
  if (!match) {
    return { name: data, value: data };
  }

  return {
    name: match[1],
    value: match[2]
  };
}

export default Editor;
