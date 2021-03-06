(RaiselyComponents, React) => {
	const { Spinner } = RaiselyComponents;
	const { dayjs, get, displayCurrency } = RaiselyComponents.Common;
	const renderHtml = RaiselyComponents.Common.htmr;
	const { api } = RaiselyComponents;

	const CustomFormRef = RaiselyComponents.import('custom-form', { asRaw: true });
	let CustomForm;

	const errorStyle = 'style="border: 1px solid red;"';

	function singular(word) {
		return (word[word.length - 1]) !== 's' ? word : word.substr(0, word.length - 1);
	}
	function plural(word) {
		return (word[word.length - 1]) === 's' ? word : `${word}s`;
	}

	function renderValue({ values, field }) {
		let path = [];
		if (field.recordType) path.push(field.recordType);
		if (field.recordType === 'interaction') path.push('detail');
		if (!field.core) path.push(field.private ? 'private' : 'public');
		path.push(field.id);

		let value = get(values, path);
		if (!value) {
			path = ['interaction', field.interactionCategory, 'detail', path[2], field.id];
			value = get(values, path);
		}
		const content = field.default;

		switch (field.type) {
			case 'select':
				return field.options[value] || value || 'N/A';
			case 'checkbox':
				return value ? 'Yes' : 'No';
			case 'rich-description':
				return (content.indexOf('</') !== -1) ?
					renderHtml(content) : renderHtml(`<p>${content}</p>`);
			case 'date':
				return dayjs(value).format(field.format);
			case 'currency':
				return displayCurrency(value, 'SGD');
			default:
				if (value === null || (typeof value === 'undefined')) return 'N/A';
				return value;
		}
	}

	function Field({ values, field }) {
		const value = renderValue({ values, field });

		return (
			<div className="record-display__field">
				<div className="record-display__label">{field.label}</div>
				<div className="record-display__value">{value}</div>
			</div>
		);
	}

	return class DisplayRecord extends React.Component {
		state = { loading: true };

		componentDidMount() {
			this.load();
		}
		componentDidUpdate(prevProps) {
			const { fields } = this.getConfig();
			const { event } = this.props;
			const { values } = this.state;
			if (event && event.private && !values.event.private) this.setState({ values: {...values, event } })

			if (fields !== this.state.prevFields) {
				this.setState({ loading: true });
				this.load();
			}
		}

		getConfig() {
			console.log('Configuring display record');
			const config = Object.assign({
				models: [],
				associations: [],
			}, this.props);
			if (this.props.getValues) Object.assign(config, this.props.getValues());

			return config;
		}

		setFields = () => {
			const { fields } = this.getConfig();
			if (!CustomForm) CustomForm = CustomFormRef().html;
			const resolvedFields = CustomForm.resolveFields(fields, this.props.global.campaign.config);
			this.setState({ fields: resolvedFields });
		}

		getModelsToLoad() {
			const values = Object.assign(
				{},
				get(this.state, 'values', {}),
				get(this.props, 'values', {})
			);

			const { associations, models } = this.getConfig();
			const valueKeys = Object.keys(values);
			let associationsToLoad = Array.isArray(associations) ? associations
				.filter(assoc => !valueKeys.includes(assoc)) : [];

			const modelsToLoad = models
				.filter(model => !valueKeys.includes(model));
			return { associationsToLoad, modelsToLoad, values };
		}

		load = async () => {
			console.log('DisplayFields.load');
			try {
				const { associations, fields } = this.getConfig();
				this.setState({ prevFields: fields });

				const { modelsToLoad, associationsToLoad, values } = this.getModelsToLoad(values);

				if (modelsToLoad.length) {
					Object.assign(values, await api.quickLoad({
						models: modelsToLoad,
						props: this.props,
						required: true,
					}));
				}

				if (Array.isArray(associations)) {
					const loaded = associationsToLoad.map(async ({ uuidFrom, recordType }) => {
						const uuid = get(values, uuidFrom);
						if (uuid) {
							const model = plural(recordType);
							const key = singular(recordType);
							values[key] = await api[model].get(uuid);
						}
					});

					await Promise.all(loaded);
				}

				this.setState({ values, loading: false }, this.setFields);
			} catch (e) {
				console.error(e);
				this.setState({ error: e.message });
				throw e;
			}
		}

		render() {
			// eslint-disable-next-line object-curly-newline
			const { loading, error, values, fields } = this.state;

			if (!get(this.props, 'global.campaign')) {
				console.error(`ERROR: ${this.constructor.name} is missing this.props.global.campaign`);
				return (
					<div className="error">
						<p>props.global.campaign property is missing.</p>
						<p>
							Did you remember to pass the props into this component? (eg
							{'<DisplayRecord {...this.props} />'}
						</p>
					</div>
				);
			}

			if (loading || !fields) {
				return <Spinner />;
			}
			if (error) {
				return (
					<div className="error">
						{this.state.error}
					</div>
				);
			}

			const settings = this.getConfig();
			const name = settings.name || '';

			const className = `record-display ${name}`;

			return (
				<div className={className}>
					{fields.map(field => (<Field
						key={field.id}
						{...this.props}
						field={field}
						values={values}
					/>))}
				</div>
			);
		}
	};
};
