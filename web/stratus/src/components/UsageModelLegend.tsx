import { usageModelLabel as label } from '../lib/usage-presentation';
import { useWorkspaceLocale } from '../lib/workspace-locale';

type Props = {
  models: string[];
  selectedModel: string | null;
  onSelect: (model: string) => void;
};

export function UsageModelLegend({ models, selectedModel, onSelect }: Props) {
  const { copy: c } = useWorkspaceLocale();
  if (models.length === 0) return null;

  return <div className="usage-model-legend" role="group" aria-label={c.modelFilter}>
    {models.map((model, index) => <button
      key={model}
      type="button"
      className={`usage-model-chip${selectedModel === model ? ' is-selected' : ''}`}
      data-testid={`button-usage-model-${index}`}
      aria-pressed={selectedModel === model}
      title={label(model)}
      onClick={() => onSelect(model)}
    >{label(model)}</button>)}
  </div>;
}
