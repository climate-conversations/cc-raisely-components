(RaiselyComponents, React) => {
	const { get } = RaiselyComponents.Common;
	const { api, Spinner } = RaiselyComponents;
	const { getData, getQuery } = api;

	const Messenger = RaiselyComponents.import('message-send-and-save');
	const ReturnButton = RaiselyComponents.import('return-button');
	const ConversationRef = RaiselyComponents.import('conversation', { asRaw: true });
	const UserSaveHelperRef = RaiselyComponents.import('cc-user-save', { asRaw: true });
	let UserSaveHelper;
	let Conversation;

	return class ConversationMessageGuests extends React.Component {
		state = { loading: true };

		componentDidMount() {
			this.load();
		}
		componentDidUpdate() {
			if (!Conversation) Conversation = ConversationRef().html;
			const eventUuid = Conversation.getUuid(this.props);
			// Reload the conversation and guests if the id has changed
			if (eventUuid !== this.state.eventUuid) {
				this.setState({ loading: true });
				this.load();
			}
		}
		load = async () => {
			try {
				if (!Conversation) Conversation = ConversationRef().html;
				const eventUuid = Conversation.getUuid(this.props);
				this.setState({ eventUuid });
				const { props } = this;
				const campaignUuid = get(this.props, 'global.campaign.uuid');
				if (!UserSaveHelper) UserSaveHelper = UserSaveHelperRef().html;

				const [results, privateCampaign] = await Promise.all([
					Conversation.loadRsvps({ props, type: ['guest'] }),
					UserSaveHelper.proxy(`/campaigns/${campaignUuid}?private=1`, {
						method: 'get',
					})
				]);

				this.setState({ ...results, privateCampaign, loading: false });
			} catch(error) {
				console.error(error);
				this.setState({ error: error.message || 'An unknown error occurred' });
			}
		}

		renderInner() {
			const { loading, guests, privateCampaign } = this.state;
			if (loading) {
				return <Spinner />;
			}

			if (!guests.length) {
				return (
					<div className="error">There are no contactable guests in this conversation</div>
				);
			}

			const defaultMessage = 'Thank you for attending the Climate Conversation!';
			const message = get(privateCampaign, 'private.conversationGuestThankyou', defaultMessage);

			const params = {
				...this.props,
				sendBy: 'email',
				body: message.body,
				to: guests,
				subject: message.subject,
				messageData: {
					sender: get(this.props, 'global.user'),
				}
			};

			return <Messenger {...params} />;
		}

		render() {
			const { props } = this;
			const { error } = this.state;
			return (
				<div className="email--guests__wrapper">
					{error ? <div className="error">{error}</div> : this.renderInner()}
					<ReturnButton {...props} backLabel="Go Back" backTheme="secondary" />
				</div>
			);
		}
	};
};
