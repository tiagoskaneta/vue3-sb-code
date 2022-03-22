import { addons, makeDecorator } from "@storybook/addons";
import kebabCase from "lodash.kebabcase"
import { h, onMounted } from "vue";

// this value doesn't seem to be exported by addons-docs
export const SNIPPET_RENDERED = `storybook/docs/snippet-rendered`;

function templateSourceCode (
  templateSource,
  args,
  argTypes,
  replacing = 'v-bind="args"',
) {
  const componentArgs = {}
  for (const [k, t] of Object.entries(argTypes)) {
    const val = args[k]
    if (typeof val !== 'undefined' && t.table && t.table.category === 'props' && val !== t.defaultValue) {
      componentArgs[k] = val
    }
  }

  const propToSource = (key, val) => {
    const type = typeof val
    switch (type) {
      case "boolean":
        return val ? key : ""
      case "string":
        return `${key}="${val}"`
      default:
        return `:${key}="${val}"`
    }
  }

  return templateSource.replace(
    replacing,
    Object.keys(componentArgs)
      .map((key) => " " + propToSource(kebabCase(key), args[key]))
      .join(""),
  )
}

export const withSource = makeDecorator({
  name: "withSource",
  wrapper: (storyFn, context) => {
    const story = storyFn(context);

    // this returns a new component that computes the source code when mounted
    // and emits an events that is handled by addons-docs
    // this approach is based on the vue (2) implementation
    // see https://github.com/storybookjs/storybook/blob/next/addons/docs/src/frameworks/vue/sourceDecorator.ts
    return {
      components: {
        Story: story,
      },

      setup() {
        onMounted(() => {
          try {
            // get the story source
            const src = context.originalStoryFn().template;
            
            // generate the source code based on the current args
            const code = templateSourceCode(
              src,
              context.args,
              context.argTypes
            );

            const channel = addons.getChannel();

            const emitFormattedTemplate = async () => {
              const prettier = await import("prettier/standalone");
              const prettierHtml = await import("prettier/parser-html");

              // emits an event  when the transformation is completed
              channel.emit(
                SNIPPET_RENDERED,
                (context || {}).id,
                prettier.format(`<template>${code}</template>`, {
                  parser: "vue",
                  plugins: [prettierHtml],
                  htmlWhitespaceSensitivity: "ignore",
                })
              );
            };

            setTimeout(emitFormattedTemplate, 0);
          } catch (e) {
            console.warn("Failed to render code", e);
          }
        });

        return () => h(story);
      },
    };
  },
});
