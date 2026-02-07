/* eslint-disable react/react-in-jsx-scope */
const Audio = () => {
    const public_path = window.__webpack_public_path__ || '/';
    const get_url = (path: string) => `${public_path.endsWith('/') ? public_path : `${public_path}/`}${path}`;

    return (
        <>
            <audio id='announcement' aria-label='audio' src={get_url('assets/media/announcement.mp3')} />
            <audio id='earned-money' aria-label='audio' src={get_url('assets/media/coins.mp3')} />
            <audio id='job-done' aria-label='audio' src={get_url('assets/media/job-done.mp3')} />
            <audio id='error' aria-label='audio' src={get_url('assets/media/out-of-bounds.mp3')} />
            <audio id='severe-error' aria-label='audio' src={get_url('assets/media/i-am-being-serious.mp3')} />
        </>
    );
};

export default Audio;
