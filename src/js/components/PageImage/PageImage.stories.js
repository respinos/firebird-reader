import PageImage from './index.svelte';
import ContainerDecorator from '../ContainerDecorator';

import { userEvent, within } from '@storybook/testing-library';
import { action } from '@storybook/addon-actions';

import { expect } from '@storybook/jest';

export default {
  title: 'Page/Image',
  component: PageImage,
  decorators: [() => ContainerDecorator],
  excludeStories: /.*Data$/,
};

export const SimpleImage = {
  args: {
    isLoaded: true,
    src: 'https://placekitten.com/200/300'
  }
}