import React, { Component } from 'react';
import Radium from 'radium';
import { getBackgrounds, uploadFilesFromUrls } from '../../actions/index';
import { connect } from 'react-redux';
import {
  SidebarWrap, ColorItem, ColorItemName, TabWrap, SideBar, AddColorBtn, ImageContainer, ImagesListContainer, Label,
  SketchPickerWrapper, SketchPickerOverlay, ColorFilterItem, ShowMoreResultsSpinner, Img, ImageWrapper, ApplyColorBtn,
  CountTag
} from '../../styledComponents';
import { SearchBar, IconTags } from '../';
import VirtualizedImagesGrid from '../VirtualizedImagesGrid';
import * as ImageGridService from '../../services/imageGrid.service';
import { Spinner } from 'scaleflex-react-ui-kit/dist';
import { fetchImages, getImagesTags } from '../../actions';
import { SketchPicker } from 'react-color';
import { Aux } from '../hoc';


class ImagesTab extends Component {
  constructor() {
    super();

    this.state = {
      isLoading: false,
      imageGridWrapperWidth: 0,
      imageContainerHeight: 0,
      imageGrid: { columnWidth: 0, gutterSize: 10, minColumnWidth: 200 },

      isSearching: false,
      searchPhrase: '',
      activePresetTag: '',
      activeTags: {},
      isBackground: true,
      activeColorFilters: [],
      defaultColor: '#00ff00',
      displayColorPicker: false,
      activeColorFilterIndex: null,
      isShowMoreImages: false
    };
    this.imageGridWrapperRef = React.createRef();
  }

  componentDidMount() {
    this.props.onGetImagesTags();
    this.props.onGetBackgrounds();
    this.updateImageGridColumnWidth();
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.imageGridWrapperRef.current && this.getImageGridWrapperWidth() !== prevState.imageGridWrapperWidth)
      this.updateImageGridColumnWidth();
  }

  onChangeColorFilter = (index) => {
    this.setState({ displayColorPicker: true, activeColorFilterIndex: index });
  }

  onRemoveColorFilter = (index) => {
    const { activeColorFilters } = this.state;

    this.setState({
      activeColorFilters:  [...activeColorFilters.slice(0, index), ...activeColorFilters.slice(index + 1)]
    });
    setTimeout(() => {
      const { activeColorFilters, searchPhrase, activePresetTag } = this.state;
      const value = searchPhrase || activePresetTag || '';

      if (!value) return;
      this.search({ value, colorFilters: activeColorFilters }, false);
    })
  }

  addColorFilter = () => {
    const { activeColorFilters } = this.state;

    activeColorFilters.push({ value: this.state.defaultColor });
    this.setState({
      displayColorPicker: !this.state.displayColorPicker,
      activeColorFilters,
      activeColorFilterIndex: activeColorFilters.length - 1
    });
  };

  handleClose = () => {
    this.setState({ displayColorPicker: false, activeColorFilterIndex: null });

    setTimeout(() => {
      const { activeColorFilters, searchPhrase, activePresetTag } = this.state;
      const value = searchPhrase || activePresetTag || '';

      if (!value) return;
      this.search({ value, colorFilters: activeColorFilters }, false);
    })
  };

  handleChange = (color) => {
    const { activeColorFilters, activeColorFilterIndex } = this.state;
    activeColorFilters[activeColorFilterIndex].value = color.hex;
    this.setState({ activeColorFilters });
  };

  getImageGridWrapperWidth = () => Math.floor(this.imageGridWrapperRef.current.getBoundingClientRect().width - 20);
  getImageGridWrapperHeight = () => this.imageGridWrapperRef.current.getBoundingClientRect().height;

  updateImageGridColumnWidth = () => {
    let { imageGrid } = this.state;
    const { minColumnWidth, gutterSize } = imageGrid;
    const imageGridWrapperWidth = this.getImageGridWrapperWidth();
    const imageContainerHeight = this.getImageGridWrapperHeight();

    imageGrid.columnWidth = ImageGridService.getActualColumnWidth(imageGridWrapperWidth, minColumnWidth, gutterSize);

    this.setState({ imageGridWrapperWidth, imageGrid, imageContainerHeight });
  };

  uploadStart = () => this.setState({ isLoading: true });

  uploadStop = () => this.setState({ isLoading: false });

  upload = (image = {}) => {
    if (this.state.isLoading) return;

    this.setState({ isLoading: true });
    this.uploadStart();
    this.props.onFileUpload(image.src, this.props.uploaderConfig)
      .then(() => this.uploadStop(), () => this.uploadStop());
  };

  onChangeSearchPhrase = ({ target }) => { this.setState({ searchPhrase: target.value }); }

  search = ({ value = '', colorFilters, offset = 0 }, refreshTags, resizeOnSuccess) => {
    const self = this;
    const { related_tags } = this.props;
    const activeTags = refreshTags ? {} : this.state.activeTags;
    const relevantActiveTags = this.getRelevantActiveTags(activeTags, related_tags);
    this.setState({ isSearching: true, activeTags, relevantActiveTags });
    const onSuccess = (response) => {
      const { payload = {} } = response;
      const { images = [] } = payload;
      if (!images.length) this.props.showAlert('0 images was found :(', '', 'warning');
      self.setState({ isSearching: false });
      typeof resizeOnSuccess === 'function' && resizeOnSuccess();
    }

    if (!value) return;

    return this.loadIcons({ value, colorFilters, offset }, relevantActiveTags, onSuccess);
  };

  onShowMoreImages = (resizeOnSuccess) => {
    if (this.state.isShowMoreImages) return;

    let { searchParams, count } = this.props;

    if (count > (searchParams.offset + 100)) {
      searchParams.offset = searchParams.offset + 100;
      return this.onSearch(searchParams.offset, resizeOnSuccess);
    }
  }

  onSearch = (offset = 0, resizeOnSuccess) => {
    if (!this.state.searchPhrase && !this.state.activePresetTag) return;
    this.setState({ activePresetTag: this.state.searchPhrase ? null : this.state.activePresetTag });

    return this.search(
      {
        value: (this.state.searchPhrase || this.state.activePresetTag || '').toLowerCase(),
        colorFilters: this.state.activeColorFilters,
        offset
      }, true, resizeOnSuccess
    );
  }

  loadIcons = (searchParams = {}, relevantActiveTags, cb = null) => {
    const { uploaderConfig } = this.props;
    const done = (response) => {
      typeof cb === 'function' && cb(response);
      this.setState({ isLoading: false, isShowMoreImages: false });
    };

    searchParams.limit = uploaderConfig.limit;

    this.setState({ isLoading: !searchParams.offset, isShowMoreImages: searchParams.offset });

    return this.props.onSearchImages(searchParams, relevantActiveTags).then(done, done);
  };

  toggleTag = (tag) => {
    const { activeTags, activeColorFilters } = this.state;
    let { activePresetTag, searchPhrase } = this.state;
    if (activePresetTag === 'backgrounds') {
      activePresetTag = '';
      searchPhrase = 'backgrounds';
    }
    const value = (searchPhrase || activePresetTag || '').toLowerCase();

    activeTags[tag] = !activeTags[tag];
    this.setState({ activeTags, searchPhrase, activePresetTag });

    setTimeout(() => {
      this.search({ value, colorFilters: activeColorFilters });
    });
  };

  getRelevantActiveTags = (activeTags, related_tags) => {
    const result = [];

    for (let tag in activeTags) {
      if (activeTags[tag] && related_tags.find(item => item.tag === tag) && activeTags.hasOwnProperty(tag))
        result.push(tag);
    }

    return result;
  }

  onActivatePresetTag = (activePresetTag) => {
    const { activeColorFilters } = this.state;
    this.setState({ activePresetTag, searchPhrase: '' });
    this.search({ value: activePresetTag, colorFilters: activeColorFilters }, true);
  }

  render() {
    const { isLoading, displayColorPicker, activeColorFilters, activeColorFilterIndex } = this.state;
    const colorFilter = activeColorFilters[activeColorFilterIndex] || {};

    return (
      <TabWrap>
        {this.renderSidebar()}
        {this.renderContent()}

        {displayColorPicker &&
        <SketchPickerWrapper>
          <SketchPickerOverlay onClick={this.handleClose}/>
          <SketchPicker color={colorFilter.value} onChange={this.handleChange}/>
          <ApplyColorBtn
            sm
            themeColor
            onClick={this.handleClose}
            style={{ zIndex: 5555, position: 'relative' }}
          >Apply</ApplyColorBtn>
        </SketchPickerWrapper>}

        <Spinner overlay show={isLoading}/>
      </TabWrap>
    )
  }

  renderSidebar = () => {
    const { activePresetTag, activeColorFilters = [] } = this.state;
    const { tags, backgrounds } = this.props;

    return (
      <SidebarWrap>
        <SideBar>
          <Label fs={'16px'} color={'black'}>Color filter</Label>

          <div style={{ margin: '0 10px'}}>
            {activeColorFilters.map((colorFilter, index) => (
              <ColorFilterItem
                index={index}
                key={`colorFilter-${index}`}
                color={colorFilter.value}
                onChangeColorFilter={this.onChangeColorFilter}
                onRemoveColorFilter={this.onRemoveColorFilter}
              />
            ))}
          </div>

          <div style={{ padding: '5px 10px 12px' }}>
            <AddColorBtn onClick={this.addColorFilter}>+ add color</AddColorBtn>
          </div>

          <Label fs={'16px'} color={'black'}>Categories</Label>

          {tags.length &&
          <ColorItem
            key={`category-background`}
            active={'backgrounds' === activePresetTag}
            onClick={() => { this.onActivatePresetTag('backgrounds'); }}
          >
            <ColorItemName>Backgrounds </ColorItemName>
            <CountTag>({backgrounds.length})</CountTag>
          </ColorItem>}
          {tags.slice(0, 20).map((item, index) => this.renderItem(item, index))}
          {!tags.length ? <Spinner black show={true} style={{ fontSize: 8, top: 10, opacity: 0.4 }}/> : null}
        </SideBar>
      </SidebarWrap>
    )
  };

  renderItem = ({ tag, label, count }, index) => {
    const { activePresetTag } = this.state;

    return (
      <ColorItem
        key={`category-${tag}`}
        active={tag === activePresetTag}
        onClick={() => { this.onActivatePresetTag(tag); }}
      >
        <ColorItemName>{label || tag.replace(/_/g, ' ').trim()}</ColorItemName>
        <CountTag>({count})</CountTag>
      </ColorItem>
    )
  }

  onKeyDown = (event, image) => {
    if (event.keyCode === 13) {
      event.preventDefault();
      event.stopPropagation();

      this.setState({ isSelected: true });
      this.forceUpdate();
      this.props.upload(image);
    }
  }

  renderContent = () => {
    const { related_tags, images, backgrounds, count } = this.props;
    const {
      imageGrid, imageContainerHeight, isLoading, isSearching, searchPhrase, activeTags, activePresetTag,
      imageGridWrapperWidth, isShowMoreImages
    } = this.state;
    const { columnWidth, gutterSize } = imageGrid;
    const isBackground = activePresetTag === 'backgrounds';
    const imagesList = isBackground ? [...backgrounds, ...images] : images;

    return (
      <ImageContainer>
        <SearchBar
          title={"You can search images here"}
          items={images}
          isLoading={isLoading}
          onSearch={() => { this.onSearch() }}
          isSearching={isSearching}
          searchPhrase={searchPhrase}
          onChangeSearchPhrase={this.onChangeSearchPhrase}
          count={count}
        />

        <IconTags
          tagsList={related_tags}
          searchPhrase={searchPhrase}
          activeTags={activeTags}
          toggleTag={this.toggleTag}
        />
          <ImagesListContainer innerRef={this.imageGridWrapperRef}>
            {(imagesList.length && imageContainerHeight && columnWidth && !isLoading) ?
              <Aux>
                <VirtualizedImagesGrid
                  imageGridWrapperWidth={imageGridWrapperWidth}
                  imageContainerHeight={imageContainerHeight}
                  columnWidth={columnWidth}
                  gutterSize={gutterSize}
                  count={imagesList.length}
                  list={imagesList}
                  upload={this.upload}
                  onShowMoreImages={this.onShowMoreImages}
                  isShowMoreImages={isShowMoreImages}
                  cellContent={({ style, columnWidth, item }) => (
                    <ImageWrapper
                      style={{ ...style, width: columnWidth }}
                      onClick={() => {
                        this.setState({ isSelected: true });
                        this.upload(item);
                      }}
                      onKeyDown={(event) => { this.onKeyDown(event, item); }}
                    >
                      <Img
                        height={columnWidth / (item.ratio || 1.6)}
                        src={ImageGridService.getCropImageUrl(item.src, columnWidth, columnWidth / (item.ratio || 1.6))}
                      />
                    </ImageWrapper>
                  )}
                />
                <ShowMoreResultsSpinner show={isShowMoreImages}/>
              </Aux>
              : null}
          </ImagesListContainer>
      </ImageContainer>
    )
  }
}

export default connect(
  ({ uploader: { backgrounds, uploaderConfig }, images: { images, related_tags, tags, count, searchParams } }) =>
    ({ backgrounds, uploaderConfig, images, related_tags, tags, count, searchParams }),
  dispatch => ({
    onGetImagesTags: () => dispatch(getImagesTags()),
    onFileUpload: (file, uploaderConfig) => dispatch(uploadFilesFromUrls([file], uploaderConfig)),
    onGetBackgrounds: () => dispatch(getBackgrounds()),
    onSearchImages: (searchParams, relevantActiveTags) => dispatch(fetchImages(searchParams, relevantActiveTags))
  })
)(Radium(ImagesTab));